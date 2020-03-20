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

const driversProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {userId} = req.body;

  let sql = sprintf("SELECT *, btrim(st_astext(latlng), 'POINT()') map_pos FROM %s WHERE fleet_id = $1 AND latlng IS NOT NULL ORDER BY created_at DESC;", dbTblName.drivers);
  try {
    let result = await db.query(sql, [userId]);
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

const router = express.Router();

router.post("/drivers", driversProc);

export default router;
