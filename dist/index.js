(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * tar-js
 * MIT (c) 2011 T. Jameson Little
 */

(function () {
	"use strict";
	
/*
struct posix_header {             // byte offset
	char name[100];               //   0
	char mode[8];                 // 100
	char uid[8];                  // 108
	char gid[8];                  // 116
	char size[12];                // 124
	char mtime[12];               // 136
	char chksum[8];               // 148
	char typeflag;                // 156
	char linkname[100];           // 157
	char magic[6];                // 257
	char version[2];              // 263
	char uname[32];               // 265
	char gname[32];               // 297
	char devmajor[8];             // 329
	char devminor[8];             // 337
	char prefix[155];             // 345
                                  // 500
};
*/

	var utils = require("./utils"),
		headerFormat;
	
	headerFormat = [
		{
			'field': 'fileName',
			'length': 100
		},
		{
			'field': 'fileMode',
			'length': 8
		},
		{
			'field': 'uid',
			'length': 8
		},
		{
			'field': 'gid',
			'length': 8
		},
		{
			'field': 'fileSize',
			'length': 12
		},
		{
			'field': 'mtime',
			'length': 12
		},
		{
			'field': 'checksum',
			'length': 8
		},
		{
			'field': 'type',
			'length': 1
		},
		{
			'field': 'linkName',
			'length': 100
		},
		{
			'field': 'ustar',
			'length': 8
		},
		{
			'field': 'owner',
			'length': 32
		},
		{
			'field': 'group',
			'length': 32
		},
		{
			'field': 'majorNumber',
			'length': 8
		},
		{
			'field': 'minorNumber',
			'length': 8
		},
		{
			'field': 'filenamePrefix',
			'length': 155
		},
		{
			'field': 'padding',
			'length': 12
		}
	];

	function formatHeader(data, cb) {
		var buffer = utils.clean(512),
			offset = 0;

		headerFormat.forEach(function (value) {
			var str = data[value.field] || "",
				i, length;

			for (i = 0, length = str.length; i < length; i += 1) {
				buffer[offset] = str.charCodeAt(i);
				offset += 1;
			}

			offset += value.length - i; // space it out with nulls
		});

		if (typeof cb === 'function') {
			return cb(buffer, offset);
		}
		return buffer;
	}
	
	module.exports.structure = headerFormat;
	module.exports.format = formatHeader;
}());

},{"./utils":3}],2:[function(require,module,exports){
/*
 * tar-js
 * MIT (c) 2011 T. Jameson Little
 */

(function () {
	"use strict";

	var header = require("./header"),
		utils = require("./utils"),
		recordSize = 512,
		blockSize;
	
	function Tar(recordsPerBlock) {
		this.written = 0;
		blockSize = (recordsPerBlock || 20) * recordSize;
		this.out = utils.clean(blockSize);
	}

	Tar.prototype.append = function (filepath, input, opts, callback) {
		var data,
			checksum,
			mode,
			mtime,
			uid,
			gid,
			headerArr;

		if (typeof input === 'string') {
			input = utils.stringToUint8(input);
		} else if (input.constructor !== Uint8Array.prototype.constructor) {
			throw 'Invalid input type. You gave me: ' + input.constructor.toString().match(/function\s*([$A-Za-z_][0-9A-Za-z_]*)\s*\(/)[1];
		}

		if (typeof opts === 'function') {
			callback = opts;
			opts = {};
		}

		opts = opts || {};

		mode = opts.mode || parseInt('777', 8) & 0xfff;
		mtime = opts.mtime || Math.floor(+new Date() / 1000);
		uid = opts.uid || 0;
		gid = opts.gid || 0;

		data = {
			fileName: filepath,
			fileMode: utils.pad(mode, 7),
			uid: utils.pad(uid, 7),
			gid: utils.pad(gid, 7),
			fileSize: utils.pad(input.length, 11),
			mtime: utils.pad(mtime, 11),
			checksum: '        ',
			type: '0', // just a file
			ustar: 'ustar  ',
			owner: opts.owner || '',
			group: opts.group || ''
		};

		// calculate the checksum
		checksum = 0;
		Object.keys(data).forEach(function (key) {
			var i, value = data[key], length;

			for (i = 0, length = value.length; i < length; i += 1) {
				checksum += value.charCodeAt(i);
			}
		});

		data.checksum = utils.pad(checksum, 6) + "\u0000 ";

		headerArr = header.format(data);

		var i, offset, length;

		this.out.set(headerArr, this.written);

		this.written += headerArr.length;

		// If there is not enough space in this.out, we need to expand it to
		// fit the new input.
		if (this.written + input.length > this.out.length) {
			this.out = utils.extend(this.out, this.written, input.length, blockSize);
		}

		this.out.set(input, this.written);

		// to the nearest multiple of recordSize
		this.written += input.length + (recordSize - (input.length % recordSize || recordSize));

		// make sure there's at least 2 empty records worth of extra space
		if (this.out.length - this.written < recordSize * 2) {
			this.out = utils.extend(this.out, this.written, recordSize * 2, blockSize);
		}

		if (typeof callback === 'function') {
			callback(this.out);
		}

		return this.out;
	};

	Tar.prototype.clear = function () {
		this.written = 0;
		this.out = utils.clean(blockSize);
	};

  Tar.utils = utils;

	Tar.stringToUint8 = utils.stringToUint8;
	Tar.uint8ToBase64 = utils.uint8ToBase64;
  Tar.base64ToUint8 = utils.base64ToUint8;
	
	module.exports = Tar;
}());

},{"./header":1,"./utils":3}],3:[function(require,module,exports){
/*
 * tar-js
 * MIT (c) 2011 T. Jameson Little
 */

(function () {
	"use strict";

	var lookup = [
			'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
			'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
			'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
			'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
			'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
			'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
			'w', 'x', 'y', 'z', '0', '1', '2', '3',
			'4', '5', '6', '7', '8', '9', '+', '/'
		];
	function clean(length) {
		var i, buffer = new Uint8Array(length);
		for (i = 0; i < length; i += 1) {
			buffer[i] = 0;
		}
		return buffer;
	}

	function extend(orig, length, addLength, multipleOf) {
		var newSize = length + addLength,
			buffer = clean((parseInt(newSize / multipleOf) + 1) * multipleOf);

		buffer.set(orig);

		return buffer;
	}

	function pad(num, bytes, base) {
		num = num.toString(base || 8);
		return "000000000000".substr(num.length + 12 - bytes) + num;
	}	
	
	function stringToUint8 (input, out, offset) {
		var i, length;

		out = out || clean(input.length);

		offset = offset || 0;
		for (i = 0, length = input.length; i < length; i += 1) {
			out[offset] = input.charCodeAt(i);
			offset += 1;
		}

		return out;
	}

	function uint8ToBase64(uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length;

		function tripletToBase64 (num) {
			return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
		};

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
			output += tripletToBase64(temp);
		}

		// this prevents an ERR_INVALID_URL in Chrome (Firefox okay)
		switch (output.length % 4) {
			case 1:
				output += '=';
				break;
			case 2:
				output += '==';
				break;
			default:
				break;
		}

		return output;
	}

	function base64ToUint8(input) {
		var base64 = input.match(/^([^=]+)/)[1],
			extraBytes = input.match(/(=*)$/)[1].length,
			i = 0, length = base64.length, temp, offset = 0,
			ret = clean(base64.length * .75 + extraBytes);

		while (i < length) {
			temp = 0;

			temp |= lookup.indexOf(base64.charAt(i) || 'A') << 18;
			i += 1;
			temp |= lookup.indexOf(base64.charAt(i) || 'A') << 12;
			i += 1;
			temp |= lookup.indexOf(base64.charAt(i) || 'A') << 6;
			i += 1;
			temp |= lookup.indexOf(base64.charAt(i) || 'A');
			i += 1;

			ret[offset] = temp >> 16 & 0xFF;
			offset += 1;
			ret[offset] = temp >> 8 & 0xFF;
			offset += 1;
			ret[offset] = temp & 0xFF;
			offset += 1;
		}

		return ret;
	}

	module.exports.clean = clean;
	module.exports.pad = pad;
	module.exports.extend = extend;
	module.exports.stringToUint8 = stringToUint8;
	module.exports.uint8ToBase64 = uint8ToBase64;
	module.exports.base64ToUint8 = base64ToUint8;
}());

},{}],4:[function(require,module,exports){
'use strict'

const domain = 'www.takaratomy.co.jp'
const Tar = require('tar-js')

/* utils */
const toArr = obj => {
  if (!obj) return []
  if (typeof obj === 'string') return []
  return Array.prototype.slice.call(obj,0)
}
const $fetch = (...arg) => {
  return fetch(arg).then(res => {
    if (res.ok) return res
    return Promise.reject(res)
  })
}
const stringToUint8 = str => {
  return (new TextEncoder()).encode(str)
}

/* parser */
function toCardType(str) {
  let map = {
    'ルリグ': 'LRIG',
    'アーツ': 'ARTS',
    'シグニ': 'SIGNI',
    'スペル': 'SPELL',
  }
  return map[str] || str
}
function toColor(str) {
  let map = {
    '白': 'WHITE',
    '黒': 'BLACK',
    '赤': 'RED',
    '青': 'BLUE',
    '緑': 'GREEN',
    '無': 'COLORLESS',
  }
  return map[str] || str
}
function toCardText(el) {
  let text = toArr(el.childNodes).map(node => {
    if (node.nodeType === node.TEXT_NODE) {
      return node.nodeValue.replace(/^\s+/,'').replace(/\s+$/,'')
    }
    if (node.nodeName === 'IMG') {
      return node.alt
    }
    if (node.nodeName === 'BR') {
      return '\n'
    }
    return node.textContent
  }).join('')
  return text
}
function toFaq(el) {
  let faq = {}
  faq.q = el.querySelector('.card_ruleFAQ_q').textContent.replace(/^\s+/,'').replace(/\s+$/,'')
  faq.a = el.querySelector('.card_ruleFAQ_a').textContent.replace(/^\s+/,'').replace(/\s+$/,'')
  return faq
}


function toInfo(doc, id) {
  let info = {}
  info.pid = id
  info.timestamp = Date.now()
  info.wxid = doc.querySelector('.card_detail_title > p').textContent
  info.name = doc.querySelector('.card_detail_title > h3').firstChild.textContent
  info.kana = doc.querySelector('.card_detail_kana').textContent.slice(1,-1)
  info.rarity = doc.querySelector('.card_rarity').textContent.replace(/\s/g,'')

  let trs = doc.querySelectorAll('.card_date_box tr')
  // info.cardType = toCardType(trs[0].children[1].textContent)
  info.cardType = trs[0].children[1].textContent
  info.class = trs[0].children[3].textContent
  // info.color = toColor(trs[1].children[1].textContent)
  info.color = trs[1].children[1].textContent
  info.level = trs[1].children[3].textContent
  info.growCost = trs[2].children[1].textContent
  info.cost = trs[2].children[3].textContent
  info.limit = trs[3].children[1].textContent
  info.power = trs[3].children[3].textContent
  info.limiting = trs[4].children[1].textContent

  // guard, limiting or coin
  let key = trs[4].children[2].textContent
  let value = trs[4].children[3].textContent
  if (key === 'ガード') {
    info.guard = value
    info.timing = '-'
  } else if (key === '使用タイミング') {
    info.guard = '-'
    info.timing = value
  } else if (key === 'コイン') {
    info.guard = '-'
    info.timing = '-'
    info.coin = value
  } else {
    console.warn(`${info.pid}: unknown key "${key}"!`)
  }

  let el = doc.querySelector('.card_skill')
  info.cardSkill = el? toCardText(el) : ''

  info.cardTexts = toArr(doc.querySelectorAll('.card_text:not(.card_skill)')).map(toCardText)

  // info.imgUrl = domain + doc.querySelector('.card_img > img').getAttribute('src')
  info.imgUrl = doc.querySelector('.card_img > img').getAttribute('src')
  info.illust = (doc.querySelector('.card_img').textContent.match(/Illust (.*)$/) || [])[1] || ''
  if (!info.illust) console.warn(`${info.pid}: no illust!`)

  info.faqs = toArr(doc.querySelectorAll('.card_FAQ > p')).map(toFaq)

  return info
}

/* fetch */
function fetchById (tar, i) {
  let url = `http://${domain}/products/wixoss/card/card_detail.php?card_id=${i}`
  return $fetch(url)
  .then(res => res.text())
  .then(html => {
    let dom = (new DOMParser()).parseFromString(html,'text/html')
    if (!dom) throw 'Failed to parse DOM!'

    // json
    let info = toInfo(dom, i)
    let json = JSON.stringify(info, null, '\t')
    let name = ('000' + i).slice(-4) + '_' + info.wxid
    tar.append(`${name}.json`, stringToUint8(json))
    console.log(`${name}.json done!`)

    // html
    html = html.replace('<head>','<head>\r\n<base href="http://www.takaratomy.co.jp/" />')
    tar.append(`${name}.html`, stringToUint8(html))
    console.log(`${name}.html done!`)

    // image
    return $fetch(info.imgUrl)
    .then(res => res.arrayBuffer())
    .then(buffer => {
      tar.append(`${name}.jpg`, new Uint8Array(buffer))
      console.log(`${name}.jpg done!`)
    })
  })
}

function fetchRange(min, max) {
  let tar = new Tar()
  let promises = []
  for (let i = min; i <= max; i++) {
    promises.push(fetchById(tar, i))
  }
  return Promise.all(promises)
  .then(() => {
    let name = ('000' + min).slice(-4) + '-' + ('000' + max).slice(-4)
    downloadTar(tar, name)
  })
}

function downloadTar(tar, name) {
  let blob = new Blob([tar.out], { type: 'application/octet-stream' })
  let url = URL.createObjectURL(blob)
  let link = document.createElement('a')
  link.href = url
  link.download = `${name}.tar`
  link.click()
}

window.fetchRange = fetchRange

},{"tar-js":2}]},{},[4])


//# sourceMappingURL=index.js.map
