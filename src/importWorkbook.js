import readExcelFile from 'read-excel-file/browser';
import { parseClassSheetRows } from './utils';

export async function parseGradeWorkbook(file, className = '七年级15班') {
  const sheets = await readExcelFile(file);
  const target = sheets.find((sheet) => sheet.sheet === className);
  if (!target) {
    const available = sheets.map((sheet) => sheet.sheet).join('、');
    throw new Error(`没有找到“${className}”工作表。当前工作表：${available}`);
  }
  return parseClassSheetRows(target.data, className);
}
