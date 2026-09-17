/** test/run.js — chạy toàn bộ bộ kiểm thử. Không chạm mạng. */
'use strict';
const fs = require('fs');
const path = require('path');
const kt = require('./kt');

const tep = fs.readdirSync(__dirname).filter(f => /\.test\.js$/.test(f)).sort();
console.log('Bộ kiểm thử công cụ quét cửa hàng — ' + tep.length + ' tệp, không có lần gọi mạng thật nào.');
for (const f of tep) require(path.join(__dirname, f));
process.exit(kt.chay() === 0 ? 0 : 1);
