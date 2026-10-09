const path = require('path');
const JSZip = require('jszip');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEXT_EXTENSIONS = new Set([
  '.txt', '.csv', '.json', '.xml', '.html', '.htm', '.md', '.log', '.rtf',
]);

function isPdf(buffer) {
  return buffer?.subarray(0, 5).toString('ascii') === '%PDF-';
}

function isPng(buffer) {
  return buffer?.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function isJpeg(buffer) {
  return buffer?.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
}

function isZip(buffer) {
  return buffer?.subarray(0, 4).toString('binary') === 'PK\x03\x04';
}

function safeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '?');
}

function xmlToText(xml) {
  return safeText(xml
    .replace(/<w:tab\s*\/?>/gi, '\t')
    .replace(/<w:br\s*\/?>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/t>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n'));
}

async function zipToText(buffer, extension) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter(name => !zip.files[name].dir && name.endsWith('.xml'));
  const preferred = names.filter(name => {
    if (extension === '.docx') return name === 'word/document.xml';
    if (extension === '.xlsx') return name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/');
    if (extension === '.pptx') return name.startsWith('ppt/slides/');
    return true;
  });
  const selected = preferred.length ? preferred : names;
  const parts = [];
  for (const name of selected) {
    parts.push(xmlToText(await zip.files[name].async('text')));
  }
  return parts.join('\n\n').trim();
}

function wrapLine(line, font, size, maxWidth) {
  const words = line.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

async function textToPdf(text, title) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - (margin * 2);
  const lines = [];
  for (const sourceLine of safeText(text).split('\n')) {
    lines.push(...wrapLine(sourceLine, font, fontSize, maxWidth));
  }
  if (!lines.length) lines.push('');

  let page = null;
  let y = 0;
  for (const line of lines) {
    if (!page || y < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      page.drawText(safeText(title).slice(0, 120), {
        x: margin, y, size: 12, font, color: rgb(0.1, 0.2, 0.35),
      });
      y -= 24;
    }
    page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.12, 0.12, 0.12) });
    y -= lineHeight;
  }
  pdf.setTitle(safeText(title));
  return Buffer.from(await pdf.save());
}

async function imageToPdf(buffer, mime, title) {
  const pdf = await PDFDocument.create();
  const image = mime === 'image/png' ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
  const maxWidth = 540;
  const maxHeight = 696;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const page = pdf.addPage([612, 792]);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: (612 - width) / 2,
    y: (792 - height) / 2,
    width,
    height,
  });
  pdf.setTitle(safeText(title));
  return Buffer.from(await pdf.save());
}

async function convertToPdf(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const title = path.basename(file.originalname || 'medical-record');
  if (isPdf(file.buffer)) return file.buffer;
  if (isPng(file.buffer)) return imageToPdf(file.buffer, 'image/png', title);
  if (isJpeg(file.buffer)) return imageToPdf(file.buffer, 'image/jpeg', title);

  if (isZip(file.buffer) && ['.docx', '.xlsx', '.pptx'].includes(extension)) {
    return textToPdf(await zipToText(file.buffer, extension), title);
  }

  const isText = file.mimetype?.startsWith('text/') || TEXT_EXTENSIONS.has(extension);
  if (isText || !file.buffer.includes(0)) {
    return textToPdf(file.buffer.toString('utf8'), title);
  }

  const error = new Error('This file format cannot be converted to PDF. Upload PDF, image, text, DOCX, XLSX, or PPTX.');
  error.statusCode = 400;
  throw error;
}

module.exports = { convertToPdf };
