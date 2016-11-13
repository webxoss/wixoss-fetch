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
      return '【' + node.alt + '】'
    }
    if (node.nodeName === 'BR') {
      return '\n'
    }
    return node.textContent
  }).join('')
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
  info.guard = trs[4].children[3].textContent

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
