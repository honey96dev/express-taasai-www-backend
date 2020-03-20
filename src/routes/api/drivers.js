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
  let {userId, page, pageSize} = req.body;

  page || (page = 1);
  pageSize || (pageSize = consts.defaultPageSize);
  const start = pageSize * (page - 1);

  let sql = sprintf("SELECT D.*, P.income_pending FROM %s D LEFT JOIN pendings_driver P ON P.id = D.id WHERE D.fleet_id = $1 AND D.deleted_at IS NULL ORDER BY created_at DESC OFFSET $2 LIMIT $3;", dbTblName.drivers);
  try {
    let result = await db.query(sql, [userId, start, pageSize]);
    const {rows} = result;
    let number = start;
    for (let row of rows) {
      row["number"] = ++number;
    }
    sql = sprintf("SELECT COUNT(*) count FROM %s WHERE fleet_id = $1 AND deleted_at IS NULL;", dbTblName.drivers);
    let count = await db.query(sql, [userId]);
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

const listProc = async (req, res, next) => {
  await _listItems(req, res, next);
}

const getProc = async (req, res, nect) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {id, userId} = req.body;

  try {
    let sql = sprintf("SELECT D.*, V.name vehicle_type, O.name AS operator FROM %s D INNER JOIN operators O ON O.id = D.operator_id INNER JOIN vehicle_types V ON V.id = D.vehicle_type_id WHERE D.id = $1 AND D.fleet_id = $2;", dbTblName.drivers);

    const {rows, rowCount} = await db.query(sql, [id, userId]);

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

const addProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {id, fleet_id, operator_id, name, dial_code, mobile_number, license_number, vehicle_name, vehicle_type_id, vehicle_brand, vehicle_model, vehicle_color, vehicle_number, vehicleImage, driverImage} = req.body;

  let fileDir = path.join(server.assetsDir, consts.uploadPath.vehicle);
  let fileName;
  if (!!vehicleImage) {
    fileName = await helpers.uploadFile(vehicleImage, fileDir);
  }
  let vehicle_image = !!vehicleImage ? sprintf("%s/%s", consts.uploadPath.vehicle, fileName) : null;
  fileDir = path.join(server.assetsDir, consts.uploadPath.driver);
  if (!!driverImage) {
    fileName = await helpers.uploadFile(driverImage, fileDir);
  }
  let driver_image = !!driverImage ? sprintf("%s/%s", consts.uploadPath.driver, fileName) : null;

  let sql;
  let rows;
  let row;
  let newRows;

  const today = new Date();
  const timestamp = dateformat(today, "yyyy-mm-dd HH:MM:ss.l'000+00'", true);
  if (!!id) {
    sql = sprintf("SELECT * FROM %s WHERE id = $1;", dbTblName.drivers);
    rows = await db.query(sql, [id]);
    rows = rows.rows;
    if (rows.length > 0) {
      row = rows[0];
      let oldFilename = path.join(fileDir, path.basename(row["vehicle_image"]));
      !!vehicleImage && fs.unlink(oldFilename, e => {

      });
      oldFilename = path.join(fileDir, path.basename(row["driver_image"]));
      !!driverImage && fs.unlink(oldFilename, e => {

      });
    }
    newRows = [
      [id, timestamp, timestamp, null, name, dial_code, mobile_number, operator_id, license_number, vehicle_name, vehicle_type_id, vehicle_brand, vehicle_model, vehicle_color, vehicle_number, vehicle_image || row["vehicle_image"], "", driver_image || row["driver_image"], "", false, false, false, false, null, fleet_id, 0, 0],
    ];
    sql = pgformat("INSERT INTO %s VALUES %L ON CONFLICT (id) DO UPDATE SET name = excluded.name, dial_code = excluded.dial_code, mobile_number = excluded.mobile_number, license_number = excluded.license_number, vehicle_name = excluded.vehicle_name, vehicle_type_id = excluded.vehicle_type_id, vehicle_brand = excluded.vehicle_brand, vehicle_model = excluded.vehicle_model, vehicle_color = excluded.vehicle_color, vehicle_number = excluded.vehicle_number, vehicle_image = excluded.vehicle_image, driver_image = excluded.driver_image RETURNING id;", dbTblName.drivers, newRows);
  } else {
    newRows = [
      [timestamp, timestamp, null, name, dial_code, mobile_number, operator_id, license_number, vehicle_name, vehicle_type_id, vehicle_brand, vehicle_model, vehicle_color, vehicle_number, vehicle_image || row["vehicle_image"], "", driver_image || row["driver_image"], "", false, false, false, false, null, fleet_id, 0, 0],
    ];
    sql = pgformat("INSERT INTO %s(created_at, updated_at, deleted_at, name, dial_code, mobile_number, operator_id, license_number, vehicle_name, vehicle_type_id, vehicle_brand, vehicle_model, vehicle_color, vehicle_number, vehicle_image, auth_token, driver_image, fcm_id, is_profile_completed, is_online, is_ride, is_active, latlng, fleet_id, balance, outgo_pending) VALUES %L ON CONFLICT (id) DO UPDATE SET name = excluded.name, dial_code = excluded.dial_code, mobile_number = excluded.mobile_number, license_number = excluded.license_number, vehicle_name = excluded.vehicle_name, vehicle_type_id = excluded.vehicle_type_id, vehicle_brand = excluded.vehicle_brand, vehicle_model = excluded.vehicle_model, vehicle_color = excluded.vehicle_color, vehicle_number = excluded.vehicle_number, vehicle_image = excluded.vehicle_image, driver_image = excluded.driver_image RETURNING id;", dbTblName.drivers, newRows);
  }
  tracer.info(sql);
  try {
    rows = await db.query(sql);
    res.status(200).send({
      result: langs.success,
      message: langs.successfullySaved,
      data: rows.rows[0],
    });
  } catch (err) {
    if (err.code == 23505) {
      res.status(200).send({
        result: langs.error,
        message: err.detail,
      });
      return;
    }
    helpers.handleErrorResponse(res, err, langs);
  }
};

const deleteProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {id} = req.body;

  const today = new Date();
  const timestamp = dateformat(today, "yyyy-mm-dd HH:MM:ss.l'000+00'", true);

  try {
    let sql = sprintf("UPDATE %s SET deleted_at = $1 WHERE id = $2;", dbTblName.drivers);
    await db.query(sql, [timestamp, id]);
    
    await _listItems(req, res, next);
  } catch (err) {
    helpers.handleErrorResponse(res, err, langs);
  }
}

const activateProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {data: {id, is_active}} = req.body;

  const today = new Date();
  const timestamp = dateformat(today, "yyyy-mm-dd HH:MM:ss.l'000+00'", true);

  try {
    let sql = sprintf("UPDATE %s SET is_active = $1 WHERE id = $2;", dbTblName.drivers);
    await db.query(sql, [is_active, id]);
    
    await _listItems(req, res, next);
  } catch (err) {
    helpers.handleErrorResponse(res, err, langs);
  }
}

const historyProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {userId, id, page, pageSize} = req.body;

  page || (page = 1);
  pageSize || (pageSize = consts.defaultPageSize);
  const start = pageSize * (page - 1);

  let sql = sprintf("SELECT R.*, P.name passenger, D.operator operator_commission, D.fleet fleet_commission FROM rides R INNER JOIN passengers P ON P.id = R.passenger_id LEFT JOIN fare_divisions D ON D.id = R.id WHERE R.driver_id = $1 ORDER BY R.created_at DESC OFFSET $2 LIMIT $3;", dbTblName.rides);
  try {
    let {rows} = await db.query(sql, [id, start, pageSize]);
    let number = start;
    for (let row of rows) {
      row["number"] = ++number;
    }
    sql = sprintf("SELECT COUNT(R.*) count FROM rides R INNER JOIN passengers P ON P.id = R.passenger_id LEFT JOIN fare_divisions D ON D.id = R.id WHERE R.driver_id = $1;", dbTblName.rides);
    let count = await db.query(sql, [id]);
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
router.post("/get", getProc);
router.post("/add", addProc);
router.post("/delete", deleteProc);
router.post("/activate", activateProc);
router.post("/history", historyProc);

export default router;
