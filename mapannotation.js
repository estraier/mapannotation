/*************************************************************************************************
 * Copyright 2025 Mikio Hirabayashi
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *************************************************************************************************/

"use strict";

function renderMapAnnotations(imgElem, listElemId) {
  if (!imgElem || !listElemId) {
    console.error("bad parameters");
    return;
  }
  if (imgElem.tagName != "IMG" && imgElem.tagName != "img") {
    console.error("bad imgElem");
    return;
  }
  let paneElem = null;
  for (let elem = imgElem.parentNode; elem; elem = elem.parentNode) {
    if (elem.dataset && "latlong" in elem.dataset) {
      paneElem = elem;
      break;
    }
  }
  if (!paneElem) {
    console.error("element with latlong is missing");
    return;
  }
  let listElem = document.getElementById(listElemId);
  if (!listElem) {
    console.error("missing element of listElem");
    return;
  }
  let listText = listElem.textContent;
  let records = null;
  if (listText.match(/^\s*\[\s*\{[\s\S]+\}\s*\]\s*$/)) {
    records = JSON.parse(listText);
  } else {
    records = _parseAnnotationCSV(listText);
  }
  if (paneElem.style.position != "absolute" && paneElem.style.position != "fixed") {
    paneElem.style.position = "relative";
  }
  paneElem.style.padding = "0px";
  paneElem.style.border = "none";
  imgElem.style.zIndex = "0";
  imgElem.timeout = setTimeout(() => {
    imgElem.lastWidth = imgElem.width;
    _renderMapAnnotationsImpl(imgElem, paneElem, records);
  }, 100);
  window.addEventListener("resize", () => {
    clearTimeout(imgElem.timeout);
    imgElem.timeout = setTimeout(() => {
      if (imgElem.lastWidth == imgElem.width) return;
      imgElem.lastWidth = imgElem.width;
      _renderMapAnnotationsImpl(imgElem, paneElem, records);
    }, 100);
  });
}

function _latitudeToMercatorY(latitude) {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI / 180) / 2));
}

function _longitudeToMercatorX(longitude) {
  return longitude / 180;
}

function _renderMapAnnotationsImpl(imgElem, paneElem, records) {
  let latlongFields = paneElem.dataset.latlong.split(",");
  if (latlongFields.length != 4) {
    console.error("bad latlong format");
    return;
  }
  let swapChildren = []
  for (let child of paneElem.children) {
    if (!child.isAnnotation) {
      swapChildren.push(child);
    }
  }
  paneElem.innerHTML = '';
  for (let child of swapChildren) {
     paneElem.appendChild(child);
  }
  let isAllOpen = false;
  if (paneElem.dataset && "allopen" in paneElem.dataset) {
    isAllOpen = ["allopen", "true", "1"].includes(paneElem.dataset.allopen);
  }
  let startLat = _latitudeToMercatorY(parseFloat(latlongFields[0]));
  let startLong = _longitudeToMercatorX(parseFloat(latlongFields[1]));
  let endLat = _latitudeToMercatorY(parseFloat(latlongFields[2]));
  let endLong = _longitudeToMercatorX(parseFloat(latlongFields[3]));
  let latDist = startLat - endLat;
  let longDist = endLong - startLong;
  let imgWidth = imgElem.clientWidth;
  let imgHeight = imgElem.clientHeight;
  let imgRect = imgElem.getBoundingClientRect();
  for (let record of records) {
    let latRatio = null;
    let longRatio = null;
    if (typeof record.yratio === "number") {
      latRatio = record.yratio;
    } else {
      let recLat = _latitudeToMercatorY(record.latitude);
      if (recLat > startLat) {
        console.warn("larger latitude: " + record.label);
        continue;
      }
      if (recLat < endLat) {
        console.warn("smaller latitude: " + record.label);
        continue;
      }
      latRatio = (startLat - recLat) / latDist;
    }
    if (typeof record.xratio === "number") {
      longRatio = record.xratio;
    } else {
      let recLong = _longitudeToMercatorX(record.longitude);
      if (recLong < startLong) {
        console.warn("smaller longitude: " + record.label);
        continue;
      }
      if (recLong > endLong) {
        console.warn("larger longitude: " + record.label);
        continue;
      }
      longRatio = (recLong - startLong) / longDist;
    }
    let pinBoxElem = document.createElement("div");
    pinBoxElem.className = "mapannotpinbox";
    if (record.style && record.style.length > 0) {
      pinBoxElem.className = pinBoxElem.className + " " + record.style + "pin";
    }
    let pinTextElem = document.createElement("span");
    pinTextElem.className = "mapannotpintext";
    pinBoxElem.appendChild(pinTextElem);
    pinBoxElem.isAnnotation = true;
    paneElem.appendChild(pinBoxElem);
    pinBoxElem.style.left = Math.round((imgWidth * longRatio) - pinBoxElem.clientWidth * 0.5) + "px";
    pinBoxElem.style.top = Math.round((imgHeight * latRatio) - pinBoxElem.clientHeight * 0.9) + "px";
    pinBoxElem.style.zIndex = "2";
    let annotBoxElem = document.createElement("div");
    annotBoxElem.className = "mapannotannotbox";
    if (record.style && record.style.length > 0) {
      annotBoxElem.className = annotBoxElem.className + " " + record.style + "annot";
    }
    annotBoxElem.style.left = Math.round((imgWidth * longRatio) - pinBoxElem.clientWidth * 0.5) + "px";
    annotBoxElem.style.top = Math.round((imgHeight * latRatio) + pinBoxElem.clientHeight * 0.1) + "px";
    annotBoxElem.style.zIndex = "1";
    annotBoxElem.isAnnotation = true;
    paneElem.appendChild(annotBoxElem);
    let annotRect = annotBoxElem.getBoundingClientRect();
    if (annotRect.left < 1) {
      annotBoxElem.style.left = "1px";
    }
    if (annotRect.right >= imgRect.right) {
      annotBoxElem.style.left = Math.max(parseInt(annotBoxElem.style.left) - annotRect.width +
                                         pinBoxElem.clientWidth * 0.8, 0) + "px";
    }
    if (annotRect.bottom >= imgRect.bottom) {
      annotBoxElem.style.top = Math.max(parseInt(annotBoxElem.style.top) - annotRect.height +
                                        pinBoxElem.clientHeight * 0.3, 0) + "px";
    }
    if (!isAllOpen) {
      pinBoxElem.addEventListener("click", () => {
        if (annotBoxElem.pinned) {
          annotBoxElem.style.display = "none";
          annotBoxElem.style.zIndex = "1";
          pinBoxElem.style.zIndex = "2";
          annotBoxElem.pinned = false;
        } else {
          annotBoxElem.style.display = "block";
          annotBoxElem.style.zIndex = "11";
          pinBoxElem.style.zIndex = "12";
          annotBoxElem.pinned = true;
        }
      });
      pinBoxElem.addEventListener("mouseover", () => {
        annotBoxElem.style.display = "block";
        annotBoxElem.style.zIndex = "11";
        pinBoxElem.style.zIndex = "12";
      });
      pinBoxElem.addEventListener("mouseout", () => {
        if (annotBoxElem.pinned) return;
        annotBoxElem.style.display = "none";
        annotBoxElem.style.zIndex = "1";
        pinBoxElem.style.zIndex = "2";
      });
      annotBoxElem.addEventListener("mouseover", () => {
        annotBoxElem.style.display = "block";
        annotBoxElem.style.zIndex = "11";
        pinBoxElem.style.zIndex = "12";
      });
      annotBoxElem.addEventListener("mouseout", () => {
        if (annotBoxElem.pinned) return;
        annotBoxElem.style.display = "none";
        annotBoxElem.style.zIndex = "1";
        pinBoxElem.style.zIndex = "2";
      });
      annotBoxElem.style.display = "none";
    }
    _renderAnnot(record, annotBoxElem);
  }
}

function _renderAnnot(record, annotBoxElem) {
  if (record.label && record.label.length > 0) {
    let labelElem = document.createElement("h2");
    labelElem.className = "mapannotannotlabel";
    if (record.links && record.links.length > 0) {
      let linkElem = document.createElement("a");
      linkElem.textContent = record.label;
      linkElem.href = record.links[0];
      labelElem.appendChild(linkElem);
    } else {
      labelElem.textContent = record.label;
    }
    annotBoxElem.appendChild(labelElem);
  }
  if (record.text && record.text.length > 0) {
    let textElem = document.createElement("p");
    textElem.className = "mapannotannottext";
    textElem.textContent = record.text;
    annotBoxElem.appendChild(textElem);
  }
  if (record.images) {
    for (let imgSrc of record.images) {
      let imgBoxElem = document.createElement("div");
      imgBoxElem.className = "mapannotannotimagebox";
      let imgLinkElem = document.createElement("a");
      imgLinkElem.className = "mapannotannotimagelink";
      imgLinkElem.href = imgSrc;
      let imgElem = document.createElement("img");
      imgElem.className = "mapannotannotimage";
      imgElem.src = imgSrc;
      imgLinkElem.appendChild(imgElem);
      imgBoxElem.appendChild(imgLinkElem);
      annotBoxElem.appendChild(imgBoxElem);
    }
  }
  if (record.links && record.links.length > 0) {
    let linkBoxElem = document.createElement("div");
    linkBoxElem.className = "mapannotannotlinkbox";
    for (let link of record.links) {
      let linkElem = document.createElement("a");
      linkElem.className = "mapannotannotlink";
      linkElem.href = link;
      linkElem.textContent = "⇒";
      linkBoxElem.appendChild(linkElem);
    }
    annotBoxElem.appendChild(linkBoxElem);
  }
  if (record.html && record.html.length > 0) {
    annotBoxElem.innerHTML = annotBoxElem.innerHTML + record.html;
  }
}

function _parseAnnotationCSV(text) {
  let records = [];
  for (let line of text.split("\n")) {
    line = line.trim();
    if (line.length < 1) continue;
    let cols = null;
    if (line.startsWith("|")) {
      cols = line.substring(1).split("|");
    } else {
      cols = line.split(",");
    }
    if (cols.length < 3) continue;
    let record = {
      label: cols[2].trim(),
      images: [],
      links: [],
      style: ''
    };
    let latexpr = cols[0].trim();
    if (latexpr.endsWith("%")) {
      record.yratio = parseFloat(latexpr) / 100;
    } else {
      record.latitude = parseFloat(latexpr);
    }
    let longexpr = cols[1].trim();
    if (longexpr.endsWith("%")) {
      record.xratio = parseFloat(longexpr) / 100;
    } else {
      record.longitude = parseFloat(longexpr);
    }
    if (cols.length > 3) {
      record.text = cols[3].trim();
    }
    if (cols.length > 4) {
      let expr = cols[4].replaceAll(/[,|]+/g, " ");
      for (let field of expr.split(" ")) {
        field = field.trim();
        if (field.length < 1) continue;
        record.images.push(field);
      }
    }
    if (cols.length > 5) {
      let expr = cols[5].replaceAll(/[,|]+/g, " ");
      for (let field of expr.split(" ")) {
        field = field.trim();
        if (field.length < 1) continue;
        record.links.push(field);
      }
    }
    if (cols.length > 6) {
      record.style = cols[6].trim();
    }
    records.push(record);
  }
  return records;
}

function renderImageGrid(paneElemId, listElemId, unitSize) {
  let paneElem = document.getElementById(paneElemId);
  if (!paneElem) {
    console.error("missing element of paneElem");
    return;
  }
  let listElem = document.getElementById(listElemId);
  if (!listElem) {
    console.error("missing element of listElem");
    return;
  }
  let listText = listElem.textContent;
  let records = null;
  if (listText.match(/^\s*\[\s*\{[\s\S]+\}\s*\]\s*$/)) {
    records = JSON.parse(listText);
  } else {
    records = _parseImageGridCSV(listText);
  }
  if (paneElem.style.position != "absolute" && paneElem.style.position != "fixed") {
    paneElem.style.position = "relative";
  }
  paneElem.timeout = setTimeout(() => {
    _renderImageGridImpl(paneElem, records, unitSize);
  }, 100);
}

function _renderImageGridImpl(paneElem, records, unitSize) {
  for (let record of records) {
    let gridElem = document.createElement("span");
    gridElem.className = "imagegridunit";
    gridElem.style.width = unitSize + "px";
    gridElem.style.height = unitSize + "px";
    let labelElem = document.createElement("div");
    labelElem.className = "imagegridlabel";
    if (record.label.length > 0) {
      labelElem.textContent = record.label;
    } else {
      labelElem.textContent = "[+]";
    }
    labelElem.style.zIndex = record.images.length + 1;
    if (record.comment && record.comment.length > 0) {
      labelElem.title = record.comment;
    }
    gridElem.appendChild(labelElem);
    if (record.images.length > 0) {
      let imgSize = Math.round(unitSize / Math.pow(record.images.length, 1/3));
      let shiftSize = Math.floor((unitSize - imgSize) / (record.images.length - 1));
      for (let i = 0; i < record.images.length; i++) {
        let imgSrc = record.images[i];
        let linkElem = document.createElement("a");
        linkElem.className = "imagegridlink";
        linkElem.style.left = (i * shiftSize) + "px";
        linkElem.style.top = (i * shiftSize) + "px";
        linkElem.style.zIndex = record.images.length - i;
        if (!_isTouchDevice()) {
          linkElem.href = imgSrc;
        }
        let imgElem = document.createElement("img");
        imgElem.src = imgSrc;
        imgElem.style.maxWidth = imgSize + "px";
        imgElem.style.maxHeight = imgSize + "px";
        if (record.images.length == 1) {
          imgElem.addEventListener("load", () => {
            linkElem.style.top = Math.floor((unitSize - imgElem.clientHeight) / 2.5) + "px";
            linkElem.style.left = Math.floor((unitSize - imgElem.clientWidth) / 2) + "px";
          });
        } else if (i > 0) {
          imgElem.addEventListener("load", () => {
            linkElem.style.top = Math.floor(
              (unitSize - imgElem.clientHeight) / (record.images.length - 1) * i) + "px";
            linkElem.style.left = Math.floor(
              (unitSize - imgElem.clientWidth) / (record.images.length - 1) * i) + "px";
          });
        }
        if (record.images.length > 1 && i == record.images.length - 1) {
          linkElem.style.left = "auto";
          linkElem.style.top = "auto";
          linkElem.style.right = "0px";
          linkElem.style.bottom = "0px";
        }
        linkElem.addEventListener("mouseover", () => {
          linkElem.style.zIndex = record.images.length + 2;
        });
        linkElem.addEventListener("mouseout", () => {
          linkElem.style.zIndex = record.images.length - i;
        });
        linkElem.appendChild(imgElem);
        gridElem.appendChild(linkElem);
      }
    }
    paneElem.appendChild(gridElem);
    labelElem.addEventListener("click", () => {
      let screenSize = Math.min(innerWidth, innerHeight);
      let coverElem = document.createElement("div");
      coverElem.className = "imagegridcover";
      document.body.appendChild(coverElem);
      let screenElem = document.createElement("div");
      screenElem.className = "imagegridscreen";
      screenElem.style.width = screenSize + "px";
      screenElem.style.height = screenSize + "px";
      coverElem.addEventListener("click", () => {
        document.body.removeChild(screenElem);
        document.body.removeChild(coverElem);
      });
      let cloneElem = gridElem.cloneNode(true);
      cloneElem.style.margin = "0px";
      cloneElem.style.border = "none";
      let zoom = screenSize / unitSize;
      if (unitSize < screenSize) {
        cloneElem.style.zoom = zoom;
      }
      for (let i = 0; i < cloneElem.children.length; i++) {
        let child = cloneElem.children[i];
        if (child.className == "imagegridlabel") {
          child.title = null;
          child.style.zoom = 1 / Math.pow(zoom, 0.5);
          child.addEventListener("click", () => {
            document.body.removeChild(screenElem);
            document.body.removeChild(coverElem);
          });
        }
        if (child.className == "imagegridlink") {
          child.addEventListener("mouseover", () => {
            child.style.zIndex = record.images.length + 2;
          });
          child.addEventListener("mouseout", () => {
            child.style.zIndex = record.images.length - i;
          });
        }
      }
      if (record.comment && record.comment.length > 0) {
        let commentElem = document.createElement("div");
        commentElem.className = "imagegridcomment";
        commentElem.textContent = record.comment;
        commentElem.style.zIndex = record.images.length + 1;
        commentElem.style.zoom = 1 / zoom;
        cloneElem.appendChild(commentElem);
      }
      let closeElem = document.createElement("div");
      closeElem.className = "imagegridclose";
      closeElem.textContent = "✕";
      closeElem.style.zIndex = cloneElem.children.length + 4;
      closeElem.style.zoom = 1 / Math.pow(zoom, 0.5);
      closeElem.addEventListener("click", () => {
        document.body.removeChild(screenElem);
        document.body.removeChild(coverElem);
      });
      cloneElem.appendChild(closeElem);
      screenElem.appendChild(cloneElem);
      document.body.appendChild(screenElem);
    });
  }
}

function _parseImageGridCSV(text) {
  let records = [];
  for (let line of text.split("\n")) {
    line = line.trim();
    if (line.length < 1) continue;
    let cols = null;
    if (line.startsWith("|")) {
      cols = line.substring(1).split("|");
    } else {
      cols = line.split(",");
    }
    let record = {
      label: cols[0].trim(),
      images: [],
    };
    if (cols.length > 1) {
      let expr = cols[1].replaceAll(/[,|]+/g, " ");
      for (let field of expr.split(" ")) {
        field = field.trim();
        if (field.length < 1) continue;
        record.images.push(field);
      }
    }
    if (cols.length > 2) {
      record.comment = cols[2].trim();
    }
    records.push(record);
  }
  return records;
}

function _isTouchDevice() {
  return Boolean('ontouchstart' in window || navigator.maxTouchPoints);
}
