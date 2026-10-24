export declare function levenshtein(a: string, b: string): number;
export declare function nameSimilarity(rawA: string, rawB: string): number;
export type ResolutionDecision = "auto-merge" | "review" | "new";
export declare function decide(similarity: number, autoMergeAt?: number, reviewLower?: number): ResolutionDecision;
export declare function jaccard(a: Iterable<string>, b: Iterable<string>): number;
