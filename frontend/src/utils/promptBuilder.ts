// Prompt 构建工具函数

/**
 * 构建一键商品图的 prompt
 * 根据产品名称和使用场景生成符合透视逻辑的场景图 prompt
 * 
 * @param productName 产品名称
 * @param scene 使用场景描述
 * @returns 构建好的 prompt 字符串
 */
export function buildProductScenePrompt(productName: string, scene: string): string {
  return `请你给图中${productName}，生成在${scene}的使用场景图，需要符合透视逻辑和使用方法，
  保证产品${productName}的一致性，不要发生产品细节偏移和变化`;
}

/**
 * 构建光影融合的 prompt
 * 根据产品名称生成增强光影真实性的 prompt
 * 
 * @param productName 产品名称
 * @returns 构建好的 prompt 字符串
 */
export function buildLightShadowPrompt(productName: string): string {
  return `不要改变画面中其余内容，增加${productName}的光影真实性和场景保持一致`;
}
