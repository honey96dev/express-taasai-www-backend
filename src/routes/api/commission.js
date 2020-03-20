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

const listProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {userId, page, pageSize} = req.body;

  page || (page = 1);
  pageSize || (pageSize = consts.defaultPageSize);
  const start = pageSize * (page - 1);

  let sql = sprintf("SELECT R.*, P.name passenger, D.operator operator_commission, D.fleet fleet_commission FROM rides R INNER JOIN passengers P ON P.id = R.passenger_id INNER JOIN fare_divisions D ON D.id = R.id WHERE R.fleet_id = $1 AND R.payment_verified = $2 ORDER BY R.created_at DESC OFFSET $3 LIMIT $4;", dbTblName.rides);
  try {
    let {rows} = await db.query(sql, [userId, 1, start, pageSize]);
    let number = start;
    for (let row of rows) {
      row["number"] = ++number;
    }
    sql = sprintf("SELECT COUNT(R.*) FROM rides R INNER JOIN passengers P ON P.id = R.passenger_id INNER JOIN fare_divisions D ON D.id = R.id WHERE R.fleet_id = $1 AND R.payment_verified = $2;", dbTblName.rides);
    let count = await db.query(sql, [userId, 1]);
    count = count.rows;
    let pageCount = 0;
    count.length > 0 && (pageCount = Math.ceil(count[0]['count'] / pageSize));

    res.status(200).send({
      result: langs.success,
      count: count[0]['count'],
      pageCount,
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

router.post("/list", listProc);

export default router;
