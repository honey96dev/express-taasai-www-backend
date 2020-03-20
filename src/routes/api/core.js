import express from "express";
import path from "path";
import fs from "fs";
import {dbTblName} from "core/config";
import strings from "core/strings";
import tracer from "core/tracer";
import consts from "core/consts";
import helpers from "core/helpers";
import db from "core/db";
import {sprintf} from "sprintf-js";

const getVehicleTypesProc = async (req, res, next) => {
  const lang = req.get(consts.lang) || consts.defaultLanguage;
  const langs = strings[lang];


  let conditions = {
    deleted_at: {
      type: "IS NULL",
      value: "",
    },
  };
  try {
    const data = await helpers.listQuery({table: dbTblName.vehicleTypes, conditions, pageSize: 500});

    res.status(200).send({
      result: langs.success,
      ...data,
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

router.post("/get-vehicle-types", getVehicleTypesProc);

export default router;
