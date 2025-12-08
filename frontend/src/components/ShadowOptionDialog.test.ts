import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildWhiteBackgroundPrompt } from './ShadowOptionDialog';

/**
 * Property 1: 提示词构造正确性
 * Feature: white-background-generator, Property 1: 提示词构造正确性
 * Validates: Requirements 1.5, 6.1, 6.2
 */
describe('buildWhiteBackgroundPrompt', () => {
  const BASE_PROMPT = '不要修改图中的产品和位置，生成产品的白底图';
  const SHADOW_REMOVAL_SUFFIX = '，去掉产品表面所有光影反射';

  it('should always contain base prompt regardless of shadow option', () => {
    fc.assert(
      fc.property(fc.boolean(), (removeShadow) => {
        const prompt = buildWhiteBackgroundPrompt(removeShadow);
        return prompt.includes(BASE_PROMPT);
      }),
      { numRuns: 100 }
    );
  });

  it('should include shadow removal text only when removeShadow is true', () => {
    fc.assert(
      fc.property(fc.boolean(), (removeShadow) => {
        const prompt = buildWhiteBackgroundPrompt(removeShadow);
        const hasShadowRemoval = prompt.includes(SHADOW_REMOVAL_SUFFIX);
        return hasShadowRemoval === removeShadow;
      }),
      { numRuns: 100 }
    );
  });

  it('should return exact prompt for keepShadow option (false)', () => {
    const prompt = buildWhiteBackgroundPrompt(false);
    expect(prompt).toBe(BASE_PROMPT);
  });

  it('should return exact prompt for removeShadow option (true)', () => {
    const prompt = buildWhiteBackgroundPrompt(true);
    expect(prompt).toBe(BASE_PROMPT + SHADOW_REMOVAL_SUFFIX);
  });

  it('should produce deterministic output for same input', () => {
    fc.assert(
      fc.property(fc.boolean(), (removeShadow) => {
        const prompt1 = buildWhiteBackgroundPrompt(removeShadow);
        const prompt2 = buildWhiteBackgroundPrompt(removeShadow);
        return prompt1 === prompt2;
      }),
      { numRuns: 100 }
    );
  });
});
