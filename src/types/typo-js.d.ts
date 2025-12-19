declare module "typo-js" {
  interface TypoSettings {
    dictionaryPath?: string;
    asyncLoad?: boolean;
    loadedCallback?: () => void;
  }

  class Typo {
    constructor(
      dictionary?: string,
      affData?: string | false,
      wordsData?: string | false,
      settings?: TypoSettings
    );

    /**
     * Check if a word is spelled correctly
     */
    check(word: string): boolean;

    /**
     * Get spelling suggestions for a word
     */
    suggest(word: string, limit?: number): string[];

    /**
     * Check if the dictionary is ready
     */
    loaded: boolean;
  }

  export = Typo;
}
