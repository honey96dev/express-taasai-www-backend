import express from "express";
import {sprintf} from "sprintf-js";
import jwt from "jsonwebtoken";
import dateformat from "dateformat";
import path from "path";
import uuid from "uuid";
import fs from "fs";
import mkdirp from "mkdirp";
import bcrypt from "bcryptjs";

import {dbTblName, session} from "core/config";
import db from "core/db";
import strings from "core/strings";
import tracer from "core/tracer";
import consts from "core/consts";
import myCrypto from "core/myCrypto";

const avatarProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {userId} = req.body;

  let sql = sprintf("SELECT * FROM `%s` WHERE `userId` = ?;", dbTblName.user_avatar);
  try {
    let rows = await db.query(sql, [userId]);
    if (!!rows.length) {
      res.status(200).send({
        result: langs.success,
        data: rows[0]["avatar"],
      });
    } else {
      res.status(200).send({
        result: langs.error,
        message: langs.notFound,
      });
    }
  } catch (err) {
    res.status(200).send({
      result: langs.error,
      message: langs.unknownServerError,
    });
  }
};

const saveAvatarProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {userId, file} = req.body;

  const today = new Date();
  const date = dateformat(today, "yyyy-mm-dd");
  // const time = dateformat(today, "hh:MM TT");
  // const timestamp = today.getTime();

  const appDir = process.cwd();
  const fileDir = path.join(appDir, "public", consts.uploadPath.avatars);
  const fileName = sprintf("%s%s", uuid(), path.extname(file.path));
  const filePath = path.join(fileDir, fileName);
  const writable = fs.createWriteStream(filePath);
  const media = sprintf("%s/%s", consts.uploadPath.avatars, fileName);
  mkdirp(fileDir, () => {
    file.on("end", async e => {
      const newRows = [
        [userId, media, date],
      ];
      let sql;
      let rows;
      if (userId) {
        sql = sprintf("SELECT * FROM `%s` WHERE `userId` = ?;", dbTblName.user_avatar);
        rows = await db.query(sql, [userId]);
        if (rows.length > 0) {
          const oldFilename = path.join(fileDir, path.basename(rows[0]["avatar"]));
          tracer.debug(oldFilename);
          fs.unlink(oldFilename, e => {

          });
        }
      }
      sql = sprintf("INSERT INTO `%s` VALUES ? ON DUPLICATE KEY UPDATE `avatar` = VALUES(`avatar`), `updatedDate` = VALUES(`updatedDate`);", dbTblName.user_avatar);
      try {
        rows = await db.query(sql, [newRows]);
        res.status(200).send({
          result: langs.success,
          message: langs.successfullySaved,
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
    });
    file.on("error", err => {
      tracer.error(err);
      tracer.error(__filename);
      res.status(200).send({
        result: langs.error,
        message: langs.unknownServerError,
        err,
      });
    });
    file.pipe(writable);
  });
};

const saveProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {id, email, username, firstName, fatherName, lastName, gender, birthday, jobTitle, sector, company, city, countryCode, phone} = req.body;

  const today = new Date();
  const date = dateformat(today, "yyyy-mm-dd");

  const newRows = [
    [id, email, "", username, firstName, fatherName, lastName, gender, birthday, jobTitle, sector, company, city, countryCode, phone, 0, 0, date, date, "", ""],
  ];

  let sql = sprintf("INSERT INTO `%s` VALUES ? ON DUPLICATE KEY UPDATE `email` = VALUES(`email`), `username` = VALUES(`username`), `firstName` = VALUES(`firstName`), `fatherName` = VALUES(`fatherName`), `lastName` = VALUES(`lastName`), `gender` = VALUES(`gender`), `birthday` = VALUES(`birthday`), `jobTitle` = VALUES(`jobTitle`), `sector` = VALUES(`sector`), `company` = VALUES(`company`), `city` = VALUES(`city`), `countryCode` = VALUES(`countryCode`), `phone` = VALUES(`phone`);", dbTblName.users);
  try {
    let rows = await db.query(sql, [newRows]);
    const token = jwt.sign(
      {
        id: id,
        email: email,
        firstName: firstName,
        lastName: lastName,
      },
      session.secret
    );
    res.status(200).send({
      result: langs.success,
      message: langs.successfullySaved,
      data: {
        user: {id, email, username, firstName, fatherName, lastName, gender, birthday, jobTitle, sector, company, city, countryCode, phone},
        token,
      },
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

const changePasswordProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  let {id, password0, password} = req.body;

  let sql = sprintf("SELECT * FROM %s WHERE id = $1;", dbTblName.users);
  try {
    let {rows, rowCount} = await db.query(sql, [id]);
    if (rowCount == 0) {
      res.status(200).send({
        result: langs.error,
        message: langs.currentPasswordIncorrect,
      });
      return;
    }
    if (!bcrypt.compareSync(password0, rows[0].password)) {
      res.status(200).send({
        result: langs.error,
        message: langs.currentPasswordIncorrect,
      });
      return;
    }
    
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    sql = sprintf("UPDATE %s SET password = $1 WHERE id = $2;", dbTblName.users);
    await db.query(sql, [hash, id]);
    res.status(200).send({
      result: langs.success,
      message: langs.passwordIsSuccessfullyChanged,
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

const getStatsProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {id} = req.body;

  let sql = sprintf("SELECT SUM(D.fleet) total_earning, (SELECT COUNT(*) FROM %s WHERE fleet_id = $1) rides_count, (SELECT COUNT(*) FROM %s WHERE fleet_id = $2) drivers_count FROM %s D INNER JOIN rides R ON R.id = D.id AND R.fleet_id = $3;", dbTblName.rides, dbTblName.drivers, dbTblName.fareDivisions);
  try {
    let {rows, rowCount} = await db.query(sql, [id, id, id]);
    if (rowCount === 0) {
      res.status(200).send({
        result: langs.error,
        message: langs.notFound,
      });
      return;
    }

    res.status(200).send({
      result: langs.success,
      data: rows[0],
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

const getBalancesProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {id} = req.body;

  let sql = sprintf("SELECT U.balance, P.income_pending FROM %s U LEFT JOIN pendings_operator P ON P.id = U.id WHERE U.id = $1;", dbTblName.users);
  try {
    let {rows, rowCount} = await db.query(sql, [id]);
    if (rowCount === 0) {
      res.status(200).send({
        result: langs.error,
        message: langs.notFound,
      });
      return;
    }

    res.status(200).send({
      result: langs.success,
      data: rows[0],
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

router.post("/avatar", avatarProc);
router.post("/save-avatar", saveAvatarProc);
router.post("/save", saveProc);
router.post("/change-password", changePasswordProc);
router.post("/get-stats", getStatsProc);
router.post("/get-balances", getBalancesProc);

export default router;
