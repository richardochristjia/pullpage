import dotenv from "dotenv";
import { Pool } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import {
  CatalogUnavailableError,
  closeCatalog,
  getCatalogProduct,
  getCatalogRuntimeStatus,
  listActiveCatalogProducts,
} from "@/catalog/catalog";

dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.TEST_CATALOG_DATABASE_URL;
const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const integration = databaseUrl && adminDatabaseUrl ? describe : describe.skip;

type PreviewConfiguration = {
  environment_name: string;
  cloud_name: string;
  asset_folder: string;
  created_at: Date;
  updated_at: Date;
};

async function installTestPreviewConfiguration(admin: Pool) {
  const previous = await admin.query<PreviewConfiguration>(
    "select environment_name, cloud_name, asset_folder, created_at, updated_at from catalog_private.product_preview_configuration",
  );
  await admin.query("delete from catalog_private.product_preview_configuration");
  await admin.query(
    "insert into catalog_private.product_preview_configuration (environment_name, cloud_name) values ('test', 'pullpage-tests')",
  );
  return previous.rows[0] ?? null;
}

async function restorePreviewConfiguration(admin: Pool, previous: PreviewConfiguration | null) {
  await admin.query("delete from catalog_private.product_preview_configuration");
  if (previous) {
    await admin.query(
      `insert into catalog_private.product_preview_configuration
        (environment_name, cloud_name, asset_folder, created_at, updated_at)
       values ($1, $2, $3, $4, $5)`,
      [previous.environment_name, previous.cloud_name, previous.asset_folder, previous.created_at, previous.updated_at],
    );
  }
}

integration("Catalog database seam", () => {
  afterAll(closeCatalog);

  test("returns the seeded active Catalog Product as a public DTO", async () => {
    const products = await listActiveCatalogProducts({ databaseUrl });

    const seeded = products.find(({ collectorNumber }) => collectorNumber === "173/165");
    expect(seeded).toEqual({
      slug: expect.stringMatching(/^pikachu-173-165-electric-bloom-[a-f0-9]{8}$/),
      cardName: "Pikachu",
      collectorNumber: "173/165",
      setName: "Scarlet & Violet—151",
      rarity: "AR",
      raritySortPosition: 5,
      designName: "Electric Bloom",
      previewUrl: null,
      formatOptions: [{ format: "Binder Sleeve", price: 95_000 }],
    });
    expect(JSON.parse(JSON.stringify(products))).toEqual(products);
  });

  test("canonicalizes optional text and exposes configured Rarity and Format Options", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const inserted = await admin.query<{ id: string; slug: string; card_name: string; collector_number: null }>(`
      insert into catalog_private.catalog_products (
        card_name, collector_number, set_name, rarity_code, design_name,
        format_code, binder_sleeve_price, toploader_price
      ) values ('  Éevee  ', E' \t ', '', 'C', null, 'ALL', 90000, 120000)
      returning id, slug, card_name, collector_number
    `);

    try {
      expect(inserted.rows[0]).toMatchObject({
        card_name: "  Éevee  ",
        collector_number: null,
      });
      expect(inserted.rows[0].slug).toMatch(/^eevee-[a-f0-9]{8}$/);

      const product = (await listActiveCatalogProducts({ databaseUrl })).find(
        ({ slug }) => slug === inserted.rows[0].slug,
      );
      expect(product).toMatchObject({
        cardName: "  Éevee  ",
        collectorNumber: null,
        setName: null,
        rarity: "C",
        raritySortPosition: 1,
        formatOptions: [
          { format: "Binder Sleeve", price: 90_000 },
          { format: "Toploader", price: 120_000 },
        ],
      });
    } finally {
      await admin.query("delete from catalog_private.catalog_products where id = $1", [
        inserted.rows[0].id,
      ]);
      await admin.end();
    }
  });

  test("looks up an active Catalog Product by immutable slug and distinguishes a successful miss", async () => {
    const products = await listActiveCatalogProducts({ databaseUrl });
    const seeded = products.find(({ collectorNumber }) => collectorNumber === "173/165");
    expect(seeded).toBeDefined();

    expect(await getCatalogProduct(seeded!.slug, { databaseUrl })).toEqual(seeded);
    expect(await getCatalogProduct("unknown-catalog-product-deadbeef", { databaseUrl })).toBeNull();
  });

  test("enforces configured Rarity and every Supported Binder Format price boundary", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const rarities = await admin.query<{ code: string; sort_position: number }>(
      "select code, sort_position from catalog_private.catalog_rarities order by sort_position",
    );
    expect(rarities.rows).toEqual([
      { code: "C", sort_position: 1 }, { code: "U", sort_position: 2 },
      { code: "R", sort_position: 3 }, { code: "RR", sort_position: 4 },
      { code: "AR", sort_position: 5 }, { code: "SR", sort_position: 6 },
      { code: "SAR", sort_position: 7 }, { code: "UR", sort_position: 8 },
    ]);

    const insert = (suffix: string, format: string | null, binder: number | null, top: number | null, rarity = "C") =>
      admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, rarity_code, format_code, binder_sleeve_price, toploader_price)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        ["Boundary", suffix, rarity, format, binder, top],
      );

    try {
      await expect(insert("missing-format", null, 1, 1)).rejects.toMatchObject({
        constraint: "catalog_product_format_required",
        hint: expect.stringMatching(/Choose BS/i),
      });
      await expect(insert("invalid-format", "BOX", 1, 1)).rejects.toMatchObject({
        constraint: "catalog_product_format_valid",
      });
      await expect(insert("negative-price", "BS", -1, null)).rejects.toMatchObject({
        constraint: "catalog_product_binder_sleeve_price_positive",
      });
      await expect(insert("fractional-price", "BS", 1.5, null)).rejects.toThrow(/integer|whole/i);
      await expect(insert("unknown-rarity", "BS", 1, null, "SECRET")).rejects.toMatchObject({
        constraint: "catalog_product_rarity_configured",
        hint: expect.stringMatching(/configured Rarity/i),
      });
      await expect(insert("bs-missing", "BS", null, 10)).rejects.toMatchObject({
        constraint: "catalog_product_binder_sleeve_price_required",
        hint: expect.stringMatching(/same save/i),
      });
      await expect(insert("tl-zero", "TL", 10, 0)).rejects.toMatchObject({
        constraint: "catalog_product_toploader_price_positive",
        hint: expect.stringMatching(/greater than zero/i),
      });
      await expect(insert("all-missing", "ALL", 10, null)).rejects.toMatchObject({
        constraint: "catalog_product_toploader_price_required",
      });

      const valid = [];
      valid.push(await insert("bs-valid", "BS", 1, 99));
      valid.push(await insert("tl-valid", "TL", 99, 1));
      valid.push(await insert("all-valid", "ALL", 1, 2));
      expect(valid).toHaveLength(3);
      const bsOnly = (await listActiveCatalogProducts({ databaseUrl })).find(
        ({ collectorNumber }) => collectorNumber === "bs-valid",
      );
      expect(bsOnly?.formatOptions).toEqual([{ format: "Binder Sleeve", price: 1 }]);
    } finally {
      await admin.query("delete from catalog_private.catalog_products where card_name = 'Boundary'");
      await admin.end();
    }
  }, 10_000);

  test("allows incomplete pending Product Preview rights but requires complete review evidence for approval", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const pending = await admin.query<{ id: string }>(
      "insert into catalog_private.product_preview_rights (status, attribution_required) values ('pending', true) returning id",
    );

    try {
      await expect(admin.query(
        "update catalog_private.product_preview_rights set status = 'approved' where id = $1",
        [pending.rows[0].id],
      )).rejects.toMatchObject({
        constraint: "product_preview_rights_approval_complete",
        hint: expect.stringMatching(/evidence/i),
      });
    } finally {
      await admin.query("delete from catalog_private.product_preview_rights where id = $1", [pending.rows[0].id]);
      await admin.end();
    }
  });

  test("links an active Catalog Product only to its exact current approved Product Preview rights", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const url = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/pikachu/electric-bloom.png";
    const previousConfiguration = await installTestPreviewConfiguration(admin);
    const rights = await admin.query<{ id: string }>(`
      insert into catalog_private.product_preview_rights (
        exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
        permission_basis, permission_evidence, channels, territories, attribution_required,
        effective_on, expires_on, status, reviewer, reviewed_at
      ) values (
        '${url}', 'asset-pikachu-v1', 'commission', 'Preview Creator', 'Pullpage',
        'written permission', 'evidence-reference', array['catalog'], array['ID'], false,
        current_date - 1, current_date, 'approved', 'Rights Reviewer', statement_timestamp()
      ) returning id
    `);

    try {
      await expect(admin.query(
        "update catalog_private.product_preview_rights set asset_identifier = 'replacement-in-place' where id = $1",
        [rights.rows[0].id],
      )).rejects.toMatchObject({ constraint: "product_preview_rights_asset_immutable" });

      await expect(admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price, product_preview_url)
         values ('Preview Pair', 'url-only', 'BS', 1, $1)`,
        [url],
      )).rejects.toMatchObject({ constraint: "catalog_product_preview_pair" });

      await expect(admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price, archived_at,
           product_preview_url, product_preview_rights_id)
         values ('Preview Pair', 'mismatch', 'BS', 1, statement_timestamp(), $1, $2)`,
        [url.replace("electric-bloom", "other"), rights.rows[0].id],
      )).rejects.toMatchObject({ constraint: "catalog_product_preview_rights_exact" });

      await admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price,
           product_preview_url, product_preview_rights_id)
         values ('Preview Pair', 'current', 'BS', 1, $1, $2)`,
        [url, rights.rows[0].id],
      );
      const projected = (await listActiveCatalogProducts({ databaseUrl })).find(
        ({ collectorNumber }) => collectorNumber === "current",
      );
      expect(projected?.previewUrl).toBe(url);
      expect(projected).not.toHaveProperty("productPreviewRightsId");
      expect(JSON.stringify(projected)).not.toContain("evidence-reference");

      await admin.query(
        "update catalog_private.product_preview_rights set status = 'rejected', takedown_notes = 'withdrawn' where id = $1",
        [rights.rows[0].id],
      );
      expect((await listActiveCatalogProducts({ databaseUrl })).find(
        ({ collectorNumber }) => collectorNumber === "current",
      )?.previewUrl).toBeNull();
      await admin.query("update catalog_private.catalog_products set archived_at = statement_timestamp() where collector_number = 'current'");
      await expect(admin.query(
        "update catalog_private.catalog_products set archived_at = null where collector_number = 'current'",
      )).rejects.toMatchObject({ constraint: "catalog_product_preview_rights_current" });
      await admin.query(
        "update catalog_private.product_preview_rights set status = 'approved' where id = $1",
        [rights.rows[0].id],
      );
      await admin.query("update catalog_private.catalog_products set archived_at = null where collector_number = 'current'");
      await admin.query(
        "update catalog_private.product_preview_rights set expires_on = current_date - 1 where id = $1",
        [rights.rows[0].id],
      );
      expect((await listActiveCatalogProducts({ databaseUrl })).find(
        ({ collectorNumber }) => collectorNumber === "current",
      )?.previewUrl).toBeNull();
      await admin.query(
        "update catalog_private.product_preview_rights set expires_on = current_date where id = $1",
        [rights.rows[0].id],
      );
      await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'other-cloud'");
      expect((await listActiveCatalogProducts({ databaseUrl })).find(
        ({ collectorNumber }) => collectorNumber === "current",
      )?.previewUrl).toBeNull();
    } finally {
      await admin.query("delete from catalog_private.catalog_products where collector_number = 'current' and product_preview_rights_id = $1", [rights.rows[0].id]);
      await admin.query("delete from catalog_private.product_preview_rights where id = $1", [rights.rows[0].id]);
      await restorePreviewConfiguration(admin, previousConfiguration);
      await admin.end();
    }
  });

  test("rejects unsafe Product Preview URLs and non-current rights without contacting delivery", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const previousConfiguration = await installTestPreviewConfiguration(admin);
    const valid = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000002/catalog-products/asset.png";
    const invalidUrls = [
      valid.replace("https://", "http://"),
      valid.replace("res.cloudinary.com", "user@res.cloudinary.com"),
      valid.replace("res.cloudinary.com", "res.cloudinary.com:443"),
      `${valid}#fragment`, `${valid}?download=1`,
      valid.replace("pullpage-tests", "unapproved-cloud"),
      valid.replace("catalog-products", "other-folder"),
      valid.replace("asset.png", "asset.svg"),
      valid.replace("/v1700000002", ""),
      valid.replace("/v1700000002", "/c_fill,w_200/v1700000002"),
    ];
    const overlongUrl = `https://res.cloudinary.com/pullpage-tests/image/upload/v1/catalog-products/${"a".repeat(2030)}.png`;
    let futureRightsId: string | null = null;
    const approve = (url: string, asset = "asset") => admin.query(`
      insert into catalog_private.product_preview_rights (
        exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
        permission_basis, permission_evidence, channels, territories, attribution_required,
        effective_on, status, reviewer, reviewed_at
      ) values ($1, $2, 'source', 'creator', 'owner', 'permission', 'evidence',
        array['catalog'], array['ID'], false, current_date, 'approved', 'reviewer', statement_timestamp())
      returning id
    `, [url, asset]);

    try {
      await expect(admin.query(`
        insert into catalog_private.product_preview_rights (
          exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
          permission_basis, permission_evidence, channels, territories, attribution_required,
          effective_on, status, reviewer, reviewed_at
        ) values ($1, 'blank-list', 'source', 'creator', 'owner', 'permission', 'evidence',
          array[''], array['ID'], false, current_date, 'approved', 'reviewer', statement_timestamp())
      `, [valid])).rejects.toMatchObject({
        constraint: "product_preview_rights_approved_lists_complete",
      });

      for (const [index, url] of invalidUrls.entries()) {
        await expect(approve(url, `invalid-${index}`)).rejects.toMatchObject({
          constraint: "product_preview_rights_url_valid",
        });
      }
      await expect(approve(overlongUrl, "overlong")).rejects.toThrow(/too long/i);

      const future = await admin.query<{ id: string }>(`
        insert into catalog_private.product_preview_rights (
          exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
          permission_basis, permission_evidence, channels, territories, attribution_required,
          effective_on, status, reviewer, reviewed_at
        ) values ($1, 'future', 'source', 'creator', 'owner', 'permission', 'evidence',
          array['catalog'], array['ID'], false, current_date + 1, 'approved', 'reviewer', statement_timestamp())
        returning id
      `, [valid]);
      futureRightsId = future.rows[0].id;
      await expect(admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price, product_preview_url, product_preview_rights_id)
         values ('Preview State', 'future', 'BS', 1, $1, $2)`,
        [valid, future.rows[0].id],
      )).rejects.toMatchObject({ constraint: "catalog_product_preview_rights_current" });
    } finally {
      if (futureRightsId) {
        await admin.query("delete from catalog_private.product_preview_rights where id = $1", [futureRightsId]);
      }
      await restorePreviewConfiguration(admin, previousConfiguration);
      await admin.end();
    }
  }, 15_000);

  test("generates bounded random slugs and protects database-owned fields", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const row = await admin.query<{
      id: string; slug: string; created_at: Date; updated_at: Date;
    }>(`
      insert into catalog_private.catalog_products
        (slug, card_name, collector_number, format_code, binder_sleeve_price, created_at, updated_at)
      values ('caller-slug', repeat('Long Name ', 20), 'slug-lifecycle', 'BS', 1, '2000-01-01', '2000-01-01')
      returning id, slug, created_at, updated_at
    `);
    const product = row.rows[0];

    try {
      expect(product.slug).toMatch(/^[a-z0-9-]+-[a-f0-9]{8}$/);
      expect(product.slug).not.toBe("caller-slug");
      expect(product.slug.length).toBeLessThanOrEqual(81);
      expect(product.created_at.getUTCFullYear()).not.toBe(2000);
      expect(product.updated_at.getUTCFullYear()).not.toBe(2000);

      await expect(
        admin.query("update catalog_private.catalog_products set id = gen_random_uuid() where id = $1", [product.id]),
      ).rejects.toMatchObject({ constraint: "catalog_product_id_immutable" });
      await expect(
        admin.query("update catalog_private.catalog_products set slug = 'changed' where id = $1", [product.id]),
      ).rejects.toMatchObject({ constraint: "catalog_product_slug_immutable" });
      await expect(
        admin.query("update catalog_private.catalog_products set created_at = '2000-01-01' where id = $1", [product.id]),
      ).rejects.toMatchObject({ constraint: "catalog_product_created_at_immutable" });

      const edited = await admin.query<{ slug: string; updated_at: Date }>(
        "update catalog_private.catalog_products set set_name = 'Edited' where id = $1 returning slug, updated_at",
        [product.id],
      );
      expect(edited.rows[0].slug).toBe(product.slug);
      expect(edited.rows[0].updated_at.getTime()).toBeGreaterThanOrEqual(product.updated_at.getTime());

      const fallback = await admin.query<{ id: string; slug: string }>(
        "insert into catalog_private.catalog_products (set_name, format_code, binder_sleeve_price) values ('Fallback Slug Probe', 'BS', 1) returning id, slug",
      );
      expect(fallback.rows[0].slug).toMatch(/^catalog-product-[a-f0-9]{8}$/);
      await admin.query("delete from catalog_private.catalog_products where id = $1", [fallback.rows[0].id]);
    } finally {
      await admin.query("delete from catalog_private.catalog_products where id = $1", [product.id]);
      await admin.end();
    }
  });

  test("enforces duplicate depiction Design Names across normalization, punctuation, and archives", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const ids: string[] = [];
    const insert = async (card: string, collector: string, set: string, design: string | null, archived = false) => {
      const result = await admin.query<{ id: string }>(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, set_name, design_name, format_code, binder_sleeve_price, archived_at)
         values ($1, $2, $3, $4, 'BS', 1, $5) returning id`,
        [card, collector, set, design, archived ? new Date() : null],
      );
      ids.push(result.rows[0].id);
      return result.rows[0].id;
    };

    try {
      await insert("  Flabébé ", "001/100", "Set   One", "Garden", true);
      await expect(insert("\tflabebe\t", "001/100", "\tset one\t", null)).rejects.toMatchObject({
        constraint: "catalog_product_duplicate_requires_design_name",
      });
      await expect(insert("FLABÉBÉ", "001/100", "SET ONE", "  Gárden  ")).rejects.toMatchObject({
        constraint: "catalog_product_duplicate_design_name_unique",
      });
      await insert("flabebe", "001/100", "set one", "Night");
      await insert("flabebe!", "001/100", "set one", null);
    } finally {
      if (ids.length) await admin.query("delete from catalog_private.catalog_products where id = any($1::uuid[])", [ids]);
      await admin.end();
    }
  });

  test("serializes concurrent duplicate saves and rolls rejected transactions back atomically", async () => {
    const first = new Pool({ connectionString: adminDatabaseUrl });
    const second = new Pool({ connectionString: adminDatabaseUrl });
    const identity = `Concurrent-${Date.now()}`;
    const sql = `insert into catalog_private.catalog_products
      (card_name, collector_number, set_name, format_code, binder_sleeve_price)
      values ($1, 'same', 'same', 'BS', 1) returning id`;

    const concurrent = await Promise.allSettled([
      first.query<{ id: string }>(sql, [identity]),
      second.query<{ id: string }>(sql, [identity]),
    ]);
    expect(concurrent.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const before = await first.query<{ card_name: string; updated_at: Date }>(
      "select card_name, updated_at from catalog_private.catalog_products where id = '11111111-1111-4111-8111-111111111111'",
    );
    await first.query("begin");
    try {
      await first.query(
        "update catalog_private.catalog_products set card_name = 'Must Roll Back' where id = '11111111-1111-4111-8111-111111111111'",
      );
      await expect(
        first.query("update catalog_private.catalog_products set format_code = 'ALL', toploader_price = null where id = '11111111-1111-4111-8111-111111111111'"),
      ).rejects.toMatchObject({ constraint: "catalog_product_toploader_price_required" });
    } finally {
      await first.query("rollback");
    }
    const after = await first.query<{ card_name: string; updated_at: Date }>(
      "select card_name, updated_at from catalog_private.catalog_products where id = '11111111-1111-4111-8111-111111111111'",
    );
    expect(after.rows).toEqual(before.rows);

    await first.query("delete from catalog_private.catalog_products where card_name = $1", [identity]);
    await first.end();
    await second.end();
  });

  test("archives an invalid-preview Catalog Product immediately and restores the same identity only after correction", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const previousConfiguration = await installTestPreviewConfiguration(admin);
    const url = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000006/catalog-products/archive/lifecycle.png";
    let rightsId: string | undefined;
    let productId: string | undefined;
    let conflictingProductId: string | undefined;

    try {
      const archiveColumn = await admin.query<{ data_type: string; is_nullable: string }>(`
        select data_type, is_nullable from information_schema.columns
        where table_schema = 'catalog_private' and table_name = 'catalog_products'
          and column_name = 'archived_at'
      `);
      expect(archiveColumn.rows).toEqual([{ data_type: "timestamp with time zone", is_nullable: "YES" }]);

      const rights = await admin.query<{ id: string }>(`
        insert into catalog_private.product_preview_rights (
          exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
          permission_basis, permission_evidence, channels, territories, attribution_required,
          effective_on, status, reviewer, reviewed_at
        ) values ($1, 'archive-lifecycle-v1', 'commission', 'Archive Creator', 'Pullpage',
          'written permission', 'archive evidence', array['catalog'], array['ID'], false,
          current_date, 'approved', 'Archive Reviewer', statement_timestamp())
        returning id
      `, [url]);
      rightsId = rights.rows[0].id;
      const inserted = await admin.query<{
        id: string; slug: string; created_at: Date; updated_at: Date;
      }>(`
        insert into catalog_private.catalog_products (
          card_name, collector_number, set_name, rarity_code, design_name, format_code,
          binder_sleeve_price, toploader_price, product_preview_url, product_preview_rights_id
        ) values ('Archive Lifecycle', '006/006', 'Workflow Set', 'AR', 'Original Design',
          'ALL', 91000, 121000, $1, $2)
        returning id, slug, created_at, updated_at
      `, [url, rightsId]);
      productId = inserted.rows[0].id;
      const original = inserted.rows[0];

      await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'withdrawn-cloud'");
      const futureArchive = new Date(Date.now() + 86_400_000);
      const archived = await admin.query<{
        id: string; slug: string; card_name: string; collector_number: string; set_name: string;
        rarity_code: string; design_name: string; format_code: string; binder_sleeve_price: number;
        toploader_price: number; product_preview_url: string; product_preview_rights_id: string;
        archived_at: Date; created_at: Date;
      }>(`
        update catalog_private.catalog_products set archived_at = $2
        where id = $1
        returning id, slug, card_name, collector_number, set_name, rarity_code, design_name,
          format_code, binder_sleeve_price, toploader_price, product_preview_url,
          product_preview_rights_id, archived_at, created_at
      `, [productId, futureArchive]);

      expect(archived.rows[0]).toMatchObject({
        id: original.id,
        slug: original.slug,
        card_name: "Archive Lifecycle",
        collector_number: "006/006",
        set_name: "Workflow Set",
        rarity_code: "AR",
        design_name: "Original Design",
        format_code: "ALL",
        binder_sleeve_price: 91_000,
        toploader_price: 121_000,
        product_preview_url: url,
        product_preview_rights_id: rightsId,
        created_at: original.created_at,
      });
      expect(archived.rows[0].archived_at.toISOString()).toBe(futureArchive.toISOString());
      expect((await listActiveCatalogProducts({ databaseUrl })).some(({ slug }) => slug === original.slug)).toBe(false);

      await expect(admin.query(
        "update catalog_private.catalog_products set archived_at = null where id = $1",
        [productId],
      )).rejects.toMatchObject({ constraint: "catalog_product_preview_rights_current" });
      await expect(admin.query(
        "update catalog_private.catalog_products set archived_at = null, format_code = 'ALL', toploader_price = null where id = $1",
        [productId],
      )).rejects.toMatchObject({ constraint: "catalog_product_toploader_price_required" });
      await expect(admin.query(
        "update catalog_private.catalog_products set archived_at = null, rarity_code = 'SECRET' where id = $1",
        [productId],
      )).rejects.toMatchObject({ constraint: "catalog_product_rarity_configured" });
      await expect(admin.query(
        "update catalog_private.catalog_products set archived_at = null, product_preview_url = null where id = $1",
        [productId],
      )).rejects.toMatchObject({ constraint: "catalog_product_preview_pair" });
      await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'pullpage-tests'");
      const conflict = await admin.query<{ id: string }>(`
        insert into catalog_private.catalog_products
          (card_name, collector_number, set_name, format_code, binder_sleeve_price)
        values ('Restore Conflict', 'same', 'same', 'BS', 1) returning id
      `);
      conflictingProductId = conflict.rows[0].id;
      await expect(admin.query(`
        update catalog_private.catalog_products
        set archived_at = null, card_name = 'Restore Conflict', collector_number = 'same',
          set_name = 'same', design_name = null
        where id = $1
      `, [productId])).rejects.toMatchObject({ constraint: "catalog_product_duplicate_requires_design_name" });

      const restored = await admin.query<{ id: string; slug: string }>(
        "update catalog_private.catalog_products set archived_at = null where id = $1 returning id, slug",
        [productId],
      );
      expect(restored.rows[0]).toEqual({ id: original.id, slug: original.slug });
      expect((await listActiveCatalogProducts({ databaseUrl })).find(({ slug }) => slug === original.slug)?.previewUrl).toBe(url);
    } finally {
      if (productId) await admin.query("delete from catalog_private.catalog_products where id = $1", [productId]);
      if (conflictingProductId) await admin.query("delete from catalog_private.catalog_products where id = $1", [conflictingProductId]);
      if (rightsId) await admin.query("delete from catalog_private.product_preview_rights where id = $1", [rightsId]);
      await restorePreviewConfiguration(admin, previousConfiguration);
      await admin.end();
    }
  });

  test("bounds connection acquisition and statements to one recoverable runtime connection", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const lockClient = await admin.connect();
    await lockClient.query("begin");
    await lockClient.query("lock table catalog_private.catalog_products in access exclusive mode");

    try {
      const statementStartedAt = Date.now();
      const blockedStatement = listActiveCatalogProducts({ databaseUrl });
      let observedConnections = 0;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        observedConnections = Math.max(observedConnections, getCatalogRuntimeStatus().connections.total);
        if (observedConnections === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const acquisitionStartedAt = Date.now();
      await expect(listActiveCatalogProducts({ databaseUrl })).rejects.toBeInstanceOf(CatalogUnavailableError);
      expect(Date.now() - acquisitionStartedAt).toBeLessThanOrEqual(7_000);
      await expect(blockedStatement).rejects.toBeInstanceOf(CatalogUnavailableError);
      expect(Date.now() - statementStartedAt).toBeLessThanOrEqual(12_000);
      expect(observedConnections).toBe(1);
      expect(getCatalogRuntimeStatus()).toMatchObject({
        connections: { maximum: 1 },
        consecutiveRefreshFailures: 2,
      });
    } finally {
      await lockClient.query("rollback");
      lockClient.release();
      await admin.end();
    }

    expect((await listActiveCatalogProducts({ databaseUrl })).length).toBeGreaterThan(0);
    expect(getCatalogRuntimeStatus().consecutiveRefreshFailures).toBe(0);
  }, 20_000);

  test("denies archive, restore, and hard deletion through the runtime database identity", async () => {
    const pool = new Pool({ connectionString: databaseUrl });

    await expect(
      pool.query("update catalog_private.catalog_products set archived_at = statement_timestamp()"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      pool.query("delete from catalog_private.catalog_products"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      pool.query("delete from catalog_public.active_catalog_products"),
    ).rejects.toThrow(/permission denied|cannot delete/i);

    await pool.end();
  });
});
