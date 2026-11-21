import {itemCatalog} from './item-catalog.mjs';
import {itemNameKey} from './item-name-key.mjs';

const lookup = name => itemCatalog.get(itemNameKey(name));
const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
function battlePass(source){
  const era = /\b(Ep(?:isode)?|V)\s*(\d{1,2})\s*Act\s*(\d{1,2})\b/i.exec(source);
  if(!era)return 'バトルパス';
  const [,prefix,number,act]=era;
  return prefix.toLowerCase()==='v'
    ? `${2000+Number(number)}年 アクト${Number(act)} バトルパス`
    : `エピソード${Number(number)} アクト${Number(act)} バトルパス`;
}
export function itemDisplayLabel({name, itemType, transactionSource}){
  const raw = name?.trim() ?? '';
  const key = itemNameKey(raw);
  const type = itemNameKey(itemType ?? '');
  if(type==='bpbundle')return battlePass(transactionSource ?? raw);
  if(key==='assortedcharitems')return 'エージェント関連アイテム一式';
  if(!key||['unknown','na','none','null'].includes(key)||raw==='名称未記録')return 'アイテム名未記録';
  // These bookkeeping labels are not the public names of individual items.
  if(key==='bundle')return 'アイテムセット（名称未記録）';
  const localized = lookup(raw);
  if(localized)return localized;
  if(/^meow\s+bundle$/i.test(raw))return 'ニャーン セット'; // display translation of the export label, not a catalog match
  const pride = /^pride\s+(20\d{2})\s+bundle$/i.exec(raw);
  if(pride)return `プライド ${pride[1]} セット`;
  const vct = /^vct\s*(\d{2}|20\d{2})\s*x\s*([\p{L}\p{N} -]+?)\s+bundle$/iu.exec(raw);
  if(vct)return `${vct[1].length===2 ? 2000+Number(vct[1]) : vct[1]} VCT ${vct[2]} チームカプセル`;
  const episode = /^(.+?),?\s+ep(?:isode)?\s+(\d+)\s+bundle$/i.exec(raw);
  if(episode){
    const label=lookup(episode[1].replace(/,$/,''));
    if(label)return `${label} エピソード${Number(episode[2])} セット`;
  }
  const butterfly = /^(Champions 20\d{2} Butterfly) Bundle$/i.exec(raw);
  if(butterfly){
    const label=lookup(`${butterfly[1]} Knife`);
    if(label)return `${label} セット`;
  }
  if(japanese.test(raw))return raw;
  return `日本語名未登録（${raw}）`;
}
