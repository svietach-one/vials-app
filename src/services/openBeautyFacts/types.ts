export interface OBFProduct {
  /** OBF's own `_id` field — stored separately from the app's Product.id. */
  obfId: string;
  name: string;
  brand: string;
  ingredientsText: string;
}

// Internal shape of a single product object returned by the OBF API.
export interface OBFRawProduct {
  _id?: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
}

export interface OBFSearchResponse {
  products?: OBFRawProduct[];
}
