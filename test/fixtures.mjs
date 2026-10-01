import { deflateSync } from 'node:zlib';

export const privacy = {
  version: '2026-10-01',
  purpose: '가상 서비스 회원 확인과 Minecraft 계정 연결을 위한 테스트 안내입니다.',
  items: ['학교가 제공한 회원 식별 정보', 'Minecraft UUID와 닉네임', '선택 입력한 Discord ID'],
  retention: '이 문구는 실제 보관 정책이 아닌 합성 테스트 안내입니다.',
  withdrawal: '운영자에게 철회·삭제를 요청하는 합성 테스트 안내입니다.',
};

// Deliberately synthetic 64x64 skin, with translucent overlay areas. No account or downloaded assets.
function chunk(type, data) {
  const name = Buffer.from(type); const content = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); content.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
const header = Buffer.alloc(13); header.writeUInt32BE(64); header.writeUInt32BE(64, 4); header[8] = 8; header[9] = 6;
const pixels = Buffer.alloc((64 * 4 + 1) * 64);
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
  const offset = y * 257 + 1 + x * 4;
  const head = y < 16;
  pixels[offset] = head ? 210 : 35; pixels[offset + 1] = head ? 168 : 98; pixels[offset + 2] = head ? 124 : 177;
  pixels[offset + 3] = (y < 16 && x >= 32) || (y >= 32 && y < 48) || (y >= 48 && (x < 16 || x >= 48)) ? 0 : 255;
}
export const skin = { dataUrl: `data:image/png;base64,${Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR', header),chunk('IDAT', deflateSync(pixels)),chunk('IEND', Buffer.alloc(0))]).toString('base64')}`, model: 'slim' };
