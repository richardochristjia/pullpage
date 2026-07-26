# Catalog promotion evidence — 2026-07-26

The owner approved a staged free-plan cutover. The complete immutable migration history was reproduced from zero in Singapore Preview and Production. Preview was qualified with deterministic synthetic data, including a bounded 500-product public projection. Production facts and all 1,128 pre-cutover journal entries were transferred exactly and verified before application cutover.

## Provider inventory

- Supabase organization: `sauhnywffljvqusyyhnb`
- Singapore Preview: `kvujpjcnjswrylgvwxwo`
- Singapore Production: `vozvldzmzfdohusojrfq`
- Paused Tokyo rollback: `wlcvenguunxriujstgxs`
- Vercel project: `prj_SElJFachKIEFvLh8WtReY4HmdMYN`
- Production deployment: `dpl_2PpvNVkyT58HbuddC6vwMyF56n4j`
- Preview deployment: `dpl_A7BbYLKtvsvB9RARfsoPsfcAiz88`
- Catalog-dependent Vercel functions: `sin1`

No credential, invalidation secret, backup key, database host, or private rights evidence is retained here.

## Results

- 17 migration files matched the SHA-256 manifest and applied from zero to both hosted targets.
- Hosted schema lint reported no errors.
- Prisma generation was identical across consecutive runs.
- Preview seed produced 501 owned rows: 480 normally active, 20 temporarily restored for the 500-product qualification, and archive coverage retained.
- All eight configured Rarities, all three Supported Binder Formats, missing facts, duplicate depictions, archive, and synthetic approved-rights cases were covered.
- Preview database integration, archive/restore, local discovery, responsive 500-product accessibility, crawler HTML, invalidation, audit, and recovery tests passed during qualification.
- The independent Production release snapshot encrypted five private tables, was decrypted in-memory for cryptographic verification, and retained its key separately.
- Source and target each exposed one identical public Catalog Product and had exactly 1,128 journal entries at transfer.
- `https://pullpage.vercel.app` returned the Production shelf with crawl-enabled robots and runtime sitemap after cutover.
- Automatic database webhook invalidation was accepted after a no-fact-change probe.
- The Tokyo project was paused, not deleted, for rollback compatibility.

Provider PITR remains unavailable on the free plan. Recovery therefore relies on the paused compatibility target, immutable migrations, the independently encrypted snapshot, transactional journal, and targeted recovery procedures.
