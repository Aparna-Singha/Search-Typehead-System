import { config } from "./config";
import {
  SearchTermRecord,
  Suggestion,
  buildPrefixes,
  compareSuggestions,
  normalizeQuery
} from "./types";

export class PrefixIndex {
  private readonly prefixMap = new Map<string, Suggestion[]>();
  private readonly termMap = new Map<string, SearchTermRecord>();
  private readonly popularSuggestions: Suggestion[] = [];

  constructor(
    private readonly topK: number = config.prefixTopK,
    private readonly popularTopK: number = config.popularTopK
  ) {}

  build(records: SearchTermRecord[]): void {
    this.prefixMap.clear();
    this.termMap.clear();
    this.popularSuggestions.length = 0;

    const sortedRecords = [...records].sort((left, right) =>
      compareSuggestions(
        { query: left.query, count: left.count },
        { query: right.query, count: right.count }
      )
    );

    for (const record of sortedRecords) {
      this.upsertTerm(record);
    }
  }

  isEmpty(): boolean {
    return this.termMap.size === 0;
  }

  size(): number {
    return this.termMap.size;
  }

  getSuggestions(prefix: string, limit: number): Suggestion[] {
    const normalizedPrefix = normalizeQuery(prefix);
    const suggestions = this.prefixMap.get(normalizedPrefix) ?? [];
    return suggestions.slice(0, limit);
  }

  getPopular(limit: number): Suggestion[] {
    return this.popularSuggestions.slice(0, limit);
  }

  getTermCount(query: string): number {
    return this.termMap.get(normalizeQuery(query))?.count ?? 0;
  }

  upsertTerm(record: SearchTermRecord): void {
    const normalizedQuery = normalizeQuery(record.query);
    const normalizedRecord: SearchTermRecord = {
      ...record,
      query: normalizedQuery
    };

    this.termMap.set(normalizedQuery, normalizedRecord);

    const suggestion: Suggestion = {
      query: normalizedQuery,
      count: normalizedRecord.count
    };

    this.mergeSuggestionList(this.popularSuggestions, suggestion, this.popularTopK);

    for (const prefix of buildPrefixes(normalizedQuery)) {
      const existingList = this.prefixMap.get(prefix) ?? [];
      this.mergeSuggestionList(existingList, suggestion, this.topK);
      this.prefixMap.set(prefix, existingList);
    }
  }

  private mergeSuggestionList(
    targetList: Suggestion[],
    suggestion: Suggestion,
    maxSize: number
  ): void {
    const existingIndex = targetList.findIndex((item) => item.query === suggestion.query);

    if (existingIndex >= 0) {
      targetList.splice(existingIndex, 1);
    }

    targetList.push(suggestion);
    targetList.sort(compareSuggestions);

    if (targetList.length > maxSize) {
      targetList.length = maxSize;
    }
  }
}

