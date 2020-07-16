import { Injectable } from '@nestjs/common';
import { FileType } from 'src/shared/models/types.helpers';
import {
  BodyResponse,
  Hits,
  ExporterResponse
} from 'src/shared/models/ResponseBody.modal';
import { ApiResponse } from '@elastic/elasticsearch';
import { Response as ExpressRes } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';
import * as libre from 'libreoffice-convert'

const ExcelJS = require('exceljs');
@Injectable()
export class ExportService {
  a
  async downloadFile(
    res: ExpressRes,
    { body: { hits, _scroll_id } }: ApiResponse<BodyResponse>,
    type: FileType,
    part: number,
    fileNameg: string,
    file,
    query,
    websiteName
  ): Promise<void> {
    try {
      this.a = fileNameg;
      const fileName = this.a
      if (hits.hits.length === 0) {
        res.json({ end: true });
        return;
      }

      const response: ExporterResponse = {
        end: hits.hits.length === 0,
        scrollId: _scroll_id,
        fileName: `${this.a}`,
        path: '/downloads',
        per_doc_size: 2000,
        total: hits.total.value
      };

      let filePath: string;

      if (type == 'docx') {
        filePath = await this.createDocx(fileNameg, hits, query, part, websiteName);
      } else if (type == 'xlsx') {
        filePath = await this.createXlxs(hits, file, part, websiteName);
      } else if (type === 'pdf') {
        filePath = await this.createPdf(await this.createDocx(fileNameg, hits, query, part, websiteName), fileName, type, res, response, part, websiteName) as string;
      }

      if (filePath)
        response.fileName = filePath
      res.json(response)
    } catch (error) {
      throw new Error(error);
    }
  }

  private async createDocx(fileName: string, hits: Hits, query: any, part, websiteName): Promise<string> {
    let sort = query.sort[0]._score.order
    let select = '';
    let search = '';
    let sortBy = "score"
    let dateObj = new Date()
    let currentDate = dateObj.toDateString()
    if (query.sort.length != 1) {
      sortBy = Object.getOwnPropertyNames(query.sort[1])[0].replace('.keyword', "")
      sort = query.sort[1][`${Object.getOwnPropertyNames(query.sort[1])[0]}`].order
    }

    if (query.query != undefined) {
      if (query.query.hasOwnProperty('query_string'))
        search = query.query.query_string.query;
      if (query.query.hasOwnProperty('bool')) {
        if (query.query.bool.filter.hasOwnProperty('term'))
          select = JSON.stringify(query.query.bool.filter.term).replace(/[^A-Za-z,: ]/g, "").replace("keyword", "")
        if (query.query.bool.hasOwnProperty('must'))
          search = query.query.bool.must.query_string.query
        if (query.query.bool.filter.hasOwnProperty('bool')) {
          query.query.bool.filter.bool.must.map(a => { select = select + JSON.stringify(a.term).replace(/[^A-Za-z,: ]/g, "").replace("keyword", " ") + ", " })
          if (query.query.bool.filter.bool.must.hasOwnProperty('query_string')) {
            search = query.query.bool.must.query_string.query
          }
        }
      }
    }
    try {
      const zip = new PizZip(
        await fs.promises.readFile(this.resolvePath(fileName + "", false), 'binary')
      );
      const doc = new Docxtemplater();
      doc.loadZip(zip);
      doc.setData({
        items: hits.hits.map(items=>items._source),
        date: currentDate,
        searchQuery: search ? "search term: " + search + "," : "",
        selectQuery: select ? select.replace(/:/g, '= ') : "",
        sortingType: sort,
        sortedBy: sortBy,
        total: hits.total.value,
      } );
      doc.render();
      const buf = doc.getZip().generate({ type: 'nodebuffer' });
      var d = new Date();
      var milliS = d.getTime()
      const filePath = this.resolvePath(`${websiteName}-${milliS}-${part}.docx`, true);
      // const spinner = ora(`🚀 writing DOCX`).start();
      return fs.promises.writeFile(filePath, buf).then(() => {
        // spinner.succeed(`👾 we are done writing DOCX`).stop();
        return `${websiteName}-${milliS}-${part}.docx`
      });
    } catch (error) {
      throw new Error(error);
    }
  }

  private async createXlxs(body, file, part, websiteName) {

    var workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('sheet', {
      pageSetup: { paperSize: 20, orientation: 'landscape', fitToPage: true }
    });
    let columns = new Array();
    for (let index = 0; index < file.tags.length; index++) {
      columns.push({ header: `${file.tags[index].label}`, width: file.tags[index].metadata.length * 3 })
    }
    worksheet.columns = columns
    const sourcesMetadata =
      body.hits.map(({ _source }) => file.tags.map(tag => _source[tag.metadata]));
    workbook.addWorksheet("My Sheet");
    for (let index = 0; index < sourcesMetadata.length; index++) {
      worksheet.getRow(index + 2).values = sourcesMetadata[index]

    }
    var d = new Date();
    var milliS = d.getTime()
    const filePath = this.resolvePath(`${websiteName}-${milliS}-${part}`, true);
    const buffer = await workbook.xlsx.writeBuffer();
    fs.writeFile(filePath + ".xlsx", buffer, (err) => {
      if (err) throw err;
    });
    return `${websiteName}-${milliS}-${part}` + ".xlsx";
  }


  private resolvePath(file: string, download?: boolean): string {
    return download
      ? path.resolve(__dirname, `../../../../data/files/downloads/${file}`)
      : path.resolve(__dirname, `../../../../data/files/${file}`);
  }

  private async createPdf(
    filePath: string,
    fileName: string,
    type: FileType,
    res: ExpressRes,
    response: object,
    part,
    websiteName
  ) {
    // const spinner = ora(`🔭 converting to PDF`).start();
    // Read file
    var d = new Date();
    var milliS = d.getTime()
    const file = fs.readFileSync(this.resolvePath(filePath, true));
    return await new Promise((resolve, rejet) => {
      libre.convert(file, type, undefined, async (err, done) => {
        if (err) {
          rejet(err)
          console.log(`Error converting file: ${err}`);
        }
        let filename = `${websiteName}-${milliS}-${part}.${type}`;
        // Here in done you have pdf file which you can save or transfer in another stream
        await fs.writeFileSync(this.resolvePath(filename, true), done);
        resolve(filename)
      });
    })
    // Convert it to pdf format with undefined filter (see Libreoffice doc about filter)

  }

}