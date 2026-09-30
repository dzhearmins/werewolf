const ADJ = ['机智的', '沉默的', '暴躁的', '优雅的', '迷糊的', '腹黑的', '话痨的', '冷酷的', '装傻的', '认真的'];
const NOUN = ['小灰', '铁柱', '翠花', '阿强', '小美', '老王', '大壮', '阿珍', '老K', '莫妮卡'];

/** 生成房间内不重名的 AI 昵称 */
export function randomAIName(existing: string[]): string {
  const used = new Set(existing);
  for (let i = 0; i < 100; i++) {
    const name = `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
    if (!used.has(name)) return name;
  }
  let n = 1;
  while (used.has(`AI玩家${n}`)) n++;
  return `AI玩家${n}`;
}
