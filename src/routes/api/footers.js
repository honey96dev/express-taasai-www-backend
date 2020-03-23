import express from "express";
import path from "path";
import fs from "fs";
import dateformat from "dateformat";
import pgformat from "pg-format";
import {dbTblName, server} from "core/config";
import strings from "core/strings";
import tracer from "core/tracer";
import consts from "core/consts";
import helpers from "core/helpers";
import db from "core/db";
import {sprintf} from "sprintf-js";

const _listItems = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];

  let sql = sprintf("SELECT * FROM %s F WHERE is_enabled = $1 AND deleted_at IS NULL ORDER BY position ASC, created_at DESC;", dbTblName.footers);
  try {
    let result = await db.query(sql, [true]);
    const {rows} = result;

    res.status(200).send({
      result: langs.success,
      data: rows,
    });
  } catch (err) {
    tracer.error(err);
    tracer.error(__filename);
    res.status(200).send({
      result: langs.error,
      message: langs.unknownServerError,
      err,
    });
  }
};

const listProc = async (req, res, next) => {
  await _listItems(req, res, next);
}

const getProc = async (req, res, nect) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {url} = req.body;

  try {
    let sql = sprintf("SELECT * FROM footers WHERE url = $1 AND is_enabled = $2 AND deleted_at IS NULL;", dbTblName.footers);

    const {rows, rowCount} = await db.query(sql, [url, true]);

    if (rowCount > 0) {
      res.status(200).send({
        result: langs.success,
        data: rows[0],
      });
    } else {
      res.status(200).send({
        result: langs.error,
        message: langs.notFound,
      });
    }
  } catch (err) {
    helpers.handleErrorResponse(res, err, langs);
  }
}

const router = express.Router();

router.post("/list", listProc);
router.post("/get", getProc);

export default router;
