'use strict';

var log = console.log.bind(console);
var Log = function (x) {
	return console.log.bind(console,x);
}
var err = console.error.bind(console);
var toArr = function (obj) {
	if (!obj) return [];
	if (typeof obj === 'string') return [];
	return Array.prototype.slice.call(obj,0);
};

var get = function (url,type,callback,err) {
	var xhr = new XMLHttpRequest();
	xhr.responseType = type;
	xhr.onload = function (e) {
		callback(xhr,e);
	};
	xhr.onerror = function (e) {
		err(xhr,e);
	};
	xhr.open('GET',url,true);
	xhr.send();
}




var domain = 'www.takaratomy.co.jp';

function toCardType (str) {
	var map = {
		'ルリグ': 'LRIG',
		'アーツ': 'ARTS',
		'シグニ': 'SIGNI',
		'スペル': 'SPELL'
	};
	return map[str] || str;
}
function toColor (str) {
	var map = {
		'白': 'WHITE',
		'黒': 'BLACK',
		'赤': 'RED',
		'青': 'BLUE',
		'緑': 'GREEN',
		'無': 'COLORLESS'
	}
	return map[str] || str;
}
function toCardText (el) {
	var text = '';
	for (var i = 0; i < el.childNodes.length; i++) {
		var child = el.childNodes[i];
		if (child.nodeType === child.TEXT_NODE) {
			text += child.nodeValue.replace(/^\s+/,'').replace(/\s+$/,'');
		} else if (child.nodeName === 'IMG') {
			text += '【' + child.alt + '】';
		} else if (child.nodeName === 'BR') {
			text += '\n';
		} else {
			text += child.textContent;
		}
	}
	return text;
}
function toFaq (el) {
	var faq = {};
	faq.q = el.querySelector('.card_ruleFAQ_q').textContent.replace(/^\s+/,'').replace(/\s+$/,'');
	faq.a = el.querySelector('.card_ruleFAQ_a').textContent.replace(/^\s+/,'').replace(/\s+$/,'');
	return faq;
}


function toInfo (doc,id) {
	var info = {};
	info.pid = id;
	info.timestamp = Date.now();
	info.wxid = doc.querySelector('.card_detail_title > p').textContent;
	info.name = doc.querySelector('.card_detail_title > h3').firstChild.textContent;
	info.kana = doc.querySelector('.card_detail_kana').textContent.slice(1,-1);
	info.rarity = doc.querySelector('.card_rarity').textContent.replace(/\s/g,'');

	var trs = doc.querySelectorAll('.card_date_box tr');
	// info.cardType = toCardType(trs[0].children[1].textContent);
	info.cardType = trs[0].children[1].textContent;
	info.class = trs[0].children[3].textContent;
	// info.color = toColor(trs[1].children[1].textContent);
	info.color = trs[1].children[1].textContent;
	info.level = trs[1].children[3].textContent;
	info.growCost = trs[2].children[1].textContent;
	info.cost = trs[2].children[3].textContent;
	info.limit = trs[3].children[1].textContent;
	info.power = trs[3].children[3].textContent;
	info.limiting = trs[4].children[1].textContent;
	info.guard = trs[4].children[3].textContent;

	var el = doc.querySelector('.card_skill');
	info.cardSkill = el? toCardText(el) : '';

	info.cardTexts = toArr(doc.querySelectorAll('.card_text:not(.card_skill)')).map(toCardText);

	// info.imgUrl = domain + doc.querySelector('.card_img > img').getAttribute('src');
	info.imgUrl = doc.querySelector('.card_img > img').getAttribute('src');
	info.illust = doc.querySelector('.card_img').textContent.match(/Illust (.*)$/)[1];

	info.faqs = toArr(doc.querySelectorAll('.card_FAQ > p')).map(toFaq);

	return info;
}


function getAndWrite (i,writer,callback) {
	var url = 'http://' + domain + '/products/wixoss/card/card_detail.php?card_id=' + i;
	get(url,'text',function (xhr) {
		var doc = (new DOMParser()).parseFromString(xhr.responseText,'text/html');
		var info = toInfo(doc,i);
		var name = ('000' + i).slice(-4) + '_' + info.wxid;
		writer.add(name + '.json',new zip.TextReader(JSON.stringify(info,null,'\t')),function () {
			log(name + '.json done!');
			var html = xhr.responseText.replace('<head>','<head>\r\n<base href="http://www.takaratomy.co.jp/" />');
			writer.add(name + '.html',new zip.TextReader(html),function () {
				log(name + '.html done!');
				// get('http://' + info.imgUrl,'blob',function (xhr) {
				get(info.imgUrl,'blob',function (xhr) {
					writer.add(name + '.jpg',new zip.BlobReader(xhr.response),function () {
						log(name + '.jpg done!');
						callback();
					});
				},err);
			});
		});
	},err);
}



var writer;
zip.useWebWorkers = false;

function initWriter () {
	zip.createWriter(new zip.BlobWriter('application/zip'), function(writer) {
		window.writer = writer;
		log('writer reday');
	},err);
}

function save (name) {
	writer.close(function (blob) {
		window.blob = blob;
		var a = window.a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = name + '.zip';
		a.click();
		initWriter();
	});
}

function getRange (min,max) {
	var i = min;
	function loop () {
		if (i > max) {
			var name = ('000' + min).slice(-4) + '-' + ('000' + max).slice(-4);
			save(name);
		} else {
			getAndWrite(i++,writer,loop);
		}
	}
	loop();
}

initWriter();