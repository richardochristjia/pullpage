# Extended-Art Catalog

The language used to describe the business's static catalog of extended-art products for Pokémon card binders.

## Language

**Catalog Product**:
One sellable extended-art design made for one specific Pokémon card illustration, regardless of how many physical copies or supported regional printings exist. English and Japanese printing facts may share a Catalog Product only when the same extended-art design fits both; a materially different illustration requires a separate Catalog Product.
_Avoid_: Listing, stock item, separate product per regional printing

**Card Name**:
The optional customer-facing name for the depicted card, displayed exactly as supplied rather than constrained to an official Pokémon naming source. A missing or blank value is presented as `No Name`.
_Avoid_: Pokémon species field, normalized official name

**English Collector Number**:
The optional identifying number printed on the English Pokémon card, such as `203/165`. It is independent of both the Japanese Collector Number and whether an English Set Name is known; a missing value means unknown or unrecorded.
_Avoid_: Shared collector number, card code, set code

**Japanese Collector Number**:
The optional identifying number printed on the Japanese Pokémon card. It is independent of both the English Collector Number and whether a Japanese Set Name is known; a missing value means unknown or unrecorded.
_Avoid_: Shared collector number, card code, set code

**English Set Name**:
The optional official English Pokémon expansion containing the depicted card. It is independent of both the Japanese Set Name and whether an English Collector Number is known; a missing value means unknown or unrecorded.
_Avoid_: English translation, English set

**Japanese Set Name**:
The optional official Japanese Pokémon expansion containing the depicted card. It is independent of both the English Set Name and whether a Japanese Collector Number is known; a missing value means unknown or unrecorded.
_Avoid_: Japanese translation, Japanese set

**Rarity**:
The optional configured Pokémon card classification, identified by a stable code and carrying a customer-facing name, display order, badge colors, and filter visibility. A known card without a rarity symbol is `No mark`, while a missing classification is presented as `Unknown rarity`; display order is not a universal rank across Pokémon eras.
_Avoid_: Card type, treating No mark as Unknown rarity, universal rarity rank

**Supported Binder Formats**:
The formats in which a Catalog Product is available: Binder Sleeve, Toploader, or both.
_Avoid_: Standard Binder, fgToploader, toploader flag

**Format Option**:
A supported binder format together with that format’s price. Every Catalog Product has at least one Format Option; Binder Sleeve and Toploader prices may differ, and all prices are denominated in Indonesian rupiah (IDR).
_Avoid_: Toploader flag, single product price

**Starting Price**:
The lowest price among the Format Options relevant to the customer’s selected Supported Binder Format; when no single format is selected, it is the lowest price for the Catalog Product.
_Avoid_: Base price, single product price

**Design Name**:
An optional customer-visible name distinguishing an extended-art design. When multiple Catalog Products target the same card, each has a distinct Design Name.
_Avoid_: Variant, binder format

**Product Preview**:
An optional thumbnail showing the finished presentation of the Pokémon card together with its extended-art surround. A missing or invalid external image URL, or one that fails its initial browser load, is replaced by a branded Pullpage placeholder; elapsed loading time alone does not make a Product Preview unavailable.
_Avoid_: Raw artwork, card image

**Catalog Visibility**:
A Catalog Product’s explicit inclusion state: active products are public, while inactive products remain recorded but are absent from every public Catalog surface. It is not stock, sales availability, approval, or archival state.
_Avoid_: Publication workflow, inventory status, archive status

**Business Contact Channel**:
The outbound messaging destination through which a customer can request a Catalog Product. A Pullpage catalog exposes at most one channel; the same channel applies to every Catalog Product, and the channel is a business contact, not a personal contact. A catalog without a configured channel offers no order path beyond the displayed prices.
_Avoid_: WhatsApp number, sales phone, admin number, personal contact, contact form
