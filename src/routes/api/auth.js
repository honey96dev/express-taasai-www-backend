import express from "express";
import jwt from "jsonwebtoken";
import {sprintf} from "sprintf-js";
import dateformat from "dateformat";
import bcrypt from "bcryptjs";

import config, {dbTblName, session} from "core/config";
import db from "core/db";
import myCrypto from "core/myCrypto";
import strings from "core/strings";
import tracer from "core/tracer";
import consts, {auth, resetPasswordUri, social, tokenStatus} from "core/consts";
import mailer from "core/mailer";
import fetch, {GET} from "core/fetch";

const _validateToken = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {email, token} = req.body;
  const today = new Date();
  const timestamp = today.getTime();

  try {
    let sql = sprintf("SELECT * FROM `%s` WHERE `email` = ? AND `token` = ?;", dbTblName.resetPasswordTokens);
    let rows = await db.query(sql, [email, token]);
    if (!rows.length) {
      return tokenStatus.NOT_FOUND;
    }

    const row = rows[0];

    if (timestamp >= row.expire) {
      return tokenStatus.EXPIRED;
    }

    const used = myCrypto.hmacHex(`${row.timestamp}${row.token}${row.expire}`);
    if (used !== row.used) {
      return tokenStatus.ALREADY_USED;
    }

    return tokenStatus.VALID;
  } catch (err) {
    throw err;
  }
};

const signInProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {email, password} = req.body;

  let sql = sprintf("SELECT U.*, O.name operator_name, P.income_pending, (SELECT COUNT(*) drivers FROM drivers D WHERE D.fleet_id = U.id) FROM %s U INNER JOIN operators O ON O.id = U.operator_id LEFT JOIN pendings_operator P ON P.id = U.id WHERE U.email = $1;", dbTblName.users);
  try {
    let result = await db.query(sql, [email]);
    if (result.rowCount === 0) {
      res.status(200).send({
        result: langs.error,
        message: langs.emailIsNotRegistered,
      });
      return;
    }

    const {rows} = result;
    const user = rows[0];
    const isMatched = bcrypt.compareSync(password, user.password)

    if (!isMatched) {
      res.status(200).send({
        result: langs.error,
        message: langs.passwordIsIncorrect,
      });
      return;
    }

    if (!!user.deletedDate && user.deletedDate.deleted_at > 0) {
      res.status(200).send({
        result: langs.error,
        message: langs.yourAccountIsClosed,
      });
      return;
    }

    // if (user.allowedDate.length === 0) {
    //   res.status(200).send({
    //     result: langs.error,
    //     message: langs.yourAccountIsNotAllowed,
    //   });
    //   return;
    // }

    const token = jwt.sign(
      {
        id: user["id"],
        email: user["email"],
        firstName: user["name"],
      },
      session.secret
    );

    // const today = new Date();
    // const date = dateformat(today, "yyyy-mm-dd");
    // const time = dateformat(today, "hh:MM TT");
    // const timestamp = today.getTime();
    // const remoteAddress = req.header["x-forwarded-for"] || req.connection.remoteAddress;
    // const newRows = [
    //   [null, user.id, timestamp, date, time, remoteAddress]
    // ];
    // sql = sprintf("INSERT INTO %s VALUES S1;", dbTblName.core.signInHistory);
    // await db.query(sql, [newRows]);

    res.status(200).send({
      result: langs.success,
      message: langs.successfullySignedIn,
      data: {
        user: {...user},
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

const signUpProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {social, socialId, email, password, username, firstName, fatherName, lastName, countryCode, phone} = req.body;
  const hash = myCrypto.hmacHex(!!social ? auth.SOCIAL_SIGN_UP_PASSWORD : password);
  const today = new Date();
  const date = dateformat(today, "yyyy-mm-dd");
  const timestamp = today.toISOString();

  let sql = sprintf("SELECT `email` FROM `%s` WHERE `email` = ?;", dbTblName.users);
  try {
    let rows = await db.query(sql, [email]);
    if (rows.length > 0) {
      res.status(200).send({
        result: langs.error,
        message: langs.emailAlreadyRegistered,
      });
      return;
    }
    const newRows = [
      [null, social || "", socialId || "", email || "", hash, username, firstName, fatherName, lastName, countryCode, phone, "", "", date, date, "", ""],
    ];
    sql = sprintf("INSERT INTO `%s` VALUES ?;", dbTblName.users);
    await db.query(sql, [newRows]);

    // sendVerificationEmail(email);

    res.status(200).send({
      result: langs.success,
      message: langs.successfullyRegistered,
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

const sendForgotPasswordMailProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {email} = req.body;

  let today = new Date();

  const timestamp = today.getTime();
  today = new Date(timestamp + consts.tokenLifetime * 3600 * 1000);
  const expire = today.getTime();
  const token = myCrypto.hmacHex(`${email}${timestamp}`);
  const used = myCrypto.hmacHex(`${timestamp}${token}${expire}`);

  let sql = sprintf("SELECT * FROM `%s` WHERE `email` = ?;", dbTblName.users);

  try {
    let rows = await db.query(sql, [email]);
    if (!rows.length) {
      res.status(200).send({
        result: langs.error,
        message: langs.emailIsNotRegistered,
      });
      return;
    }
    const user = rows[0];
    const name = `${user.firstName} ${user.lastName}`;
    const url = `${config.server.baseUrl}${resetPasswordUri}/${email}/${token}`;
    tracer.info(token);
    await mailer.sendForgotPasswordMail({email, name, url, subject: langs.forgotPassword});

    sql = sprintf("INSERT INTO `%s` VALUES ? ON DUPLICATE KEY UPDATE `timestamp` = VALUES(`timestamp`), `token` = VALUES(`token`), `expire` = VALUES(`expire`), `used` = VALUES(`used`);", dbTblName.resetPasswordTokens);

    const newRows = [
      [email, timestamp, token, expire, used],
    ];

    await db.query(sql, [newRows]);
    res.status(200).send({
      result: langs.success,
      message: langs.resetEmailIsSent,
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

const validateTokenProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  try {
    const result = await _validateToken(req, res, next);
    switch (result) {
      case tokenStatus.VALID:
        res.status(200).send({
          result: langs.success,
          message: langs.tokenIsValid,
        });
        break;
      case tokenStatus.EXPIRED:
        res.status(200).send({
          result: langs.error,
          message: langs.tokenIsExpired,
        });
        break;
      case tokenStatus.NOT_FOUND:
        res.status(200).send({
          result: langs.error,
          message: langs.tokenIsNotFound,
        });
        break;
      case tokenStatus.ALREADY_USED:
        res.status(200).send({
          result: langs.error,
          message: langs.tokenIsAlreadyUsed,
        });
        break;
    }
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

const resetPasswordProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];
  const {email, password} = req.body;

  try {
    const result = await _validateToken(req, res, next);
    switch (result) {
      case tokenStatus.EXPIRED:
        res.status(200).send({
          result: langs.error,
          message: langs.tokenIsExpired,
        });
        return;
      case tokenStatus.NOT_FOUND:
        res.status(200).send({
          result: langs.error,
          message: langs.tokenIsNotFound,
        });
        return;
      case tokenStatus.ALREADY_USED:
        res.status(200).send({
          result: langs.error,
          message: langs.tokenIsAlreadyUsed,
        });
        return;
    }

    const hash = myCrypto.hmacHex(password);
    tracer.info(password, hash);
    let sql = sprintf("UPDATE `%s` SET `used` = ? WHERE `email` = ?;", dbTblName.resetPasswordTokens);
    await db.query(sql, [1, email]);
    sql = sprintf("UPDATE `%s` SET `hash` = ? WHERE `email` = ?;", dbTblName.users);
    await db.query(sql, [hash, email]);
    res.status(200).send({
      result: langs.success,
      message: langs.successfullyChanged,
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

router.post("/sign-in", signInProc);
router.post("/sign-up", signUpProc);
router.post("/send-forgot-password-mail", sendForgotPasswordMailProc);
router.post("/validate-token", validateTokenProc);
router.post("/reset-password", resetPasswordProc);

export default router;
