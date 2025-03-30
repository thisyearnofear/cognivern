export interface AssetMatch {
  id: string;
  amount: number;
  source: string;
  assetType: string;
  lastKnownDate: Date;
  confidence: number;
  ownerIdentifiers: string[];
  documentationRequired: string[];
}
