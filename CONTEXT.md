# Extended-Art Catalog

The language used to describe the business's static catalog of extended-art products for Pokémon card binders.

## Language

**Catalog Product**:
One sellable extended-art design made for one specific Pokémon card depiction, regardless of how many physical copies exist. Its set may be unidentified.
_Avoid_: Listing, stock item

**Card Name**:
The optional customer-facing name for the depicted card, displayed exactly as supplied rather than constrained to an official Pokémon naming source. A missing or blank value is presented as `No Name`.
_Avoid_: Pokémon species field, normalized official name

**Collector Number**:
The optional identifying number printed on the Pokémon card, such as `203/165`; a missing value is presented as `Unknown number`.
_Avoid_: Card code, set code

**Set Name**:
The official Pokémon expansion containing the depicted card when it can be identified; it may be unknown.
_Avoid_: Assuming Collector Number is globally unique

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
