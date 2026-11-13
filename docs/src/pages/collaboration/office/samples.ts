export async function officeSample(kind: 'word' | 'excel' | 'pdf'): Promise<File> {
  if (kind === 'word') {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>'
    );
    zip.file(
      '_rels/.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    zip.file(
      'word/_rels/document.xml.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>'
    );
    zip.file(
      'word/styles.xml',
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="sans-serif"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style></w:styles>'
    );
    zip.file(
      'word/header1.xml',
      '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>项目评审</w:t></w:r></w:p></w:hdr>'
    );
    zip.file(
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>项目评审方案</w:t></w:r></w:p><w:p><w:r><w:t>本轮完成 </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Word、Excel 与 PDF</w:t></w:r><w:r><w:t> 在线编辑。</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="8000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:left w:val="single" w:sz="4" w:color="D9D9D9"/><w:right w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>交付项目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>验收状态</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>浏览器文件编辑</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>待复核</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'
    );
    return new File(
      [new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))],
      '项目评审示例.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    );
  }
  if (kind === 'excel') {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('预算');
    sheet.addRow(['单价', '数量', '小计']);
    sheet.addRow([100, 2, { formula: 'A2*B2', result: 200 }]);
    sheet.addRow([80, 3, { formula: 'A3*B3', result: 240 }]);
    sheet.addRow(['合计', null, { formula: 'SUM(C2:C3)', result: 440 }]);
    sheet.mergeCells('A6:C6');
    sheet.getCell('A6').value = '选择单元格，在公式栏中修改数值或公式。';
    sheet.getRow(1).font = { bold: true, color: { argb: 'FF2F684E' } };
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    ['C2', 'C3', 'C4'].forEach((address) => {
      sheet.getCell(address).numFmt = '0.00';
    });
    const summary = book.addWorksheet('汇总');
    summary.addRow(['预算总额', { formula: "'预算'!C4", result: 440 }]);
    summary.columns.forEach((column) => {
      column.width = 24;
    });
    const bytes = await book.xlsx.writeBuffer();
    return new File([new Uint8Array(bytes)], '项目预算示例.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595, 842]);
  page.drawText('PROJECT REVIEW', { x: 48, y: 760, size: 25, font, color: rgb(0.1, 0.2, 0.3) });
  page.drawText('Complete the form, add notes, and export an editable PDF.', {
    x: 48,
    y: 716,
    size: 11,
    font,
  });
  page.drawText('Reviewer', { x: 48, y: 635, size: 12, font });
  const form = document.getForm();
  const reviewer = form.createTextField('Reviewer');
  reviewer.addToPage(page, { x: 48, y: 585, width: 260, height: 32 });
  const approved = form.createCheckBox('Approved');
  approved.addToPage(page, { x: 48, y: 520, width: 18, height: 18 });
  page.drawText('Approved', { x: 80, y: 524, size: 12, font });
  const stage = form.createDropdown('Stage');
  stage.addOptions(['Draft', 'Review', 'Done']);
  stage.select('Draft');
  stage.addToPage(page, { x: 48, y: 445, width: 260, height: 32 });
  const second = document.addPage([595, 842]);
  second.drawText('REVIEW NOTES', { x: 48, y: 760, size: 25, font });
  second.drawText('Use the editor to add a note on this page.', { x: 48, y: 716, size: 12, font });
  const blob = new Blob([new Uint8Array(await document.save())], { type: 'application/pdf' });
  return new File([blob], '项目评审示例.pdf', { type: 'application/pdf' });
}
