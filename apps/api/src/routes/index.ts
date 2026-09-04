import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import properties from "./properties.js";
import marketplace from "./marketplace.js";
import resources from "./resources.js";
export const api=Router();
api.use("/marketplace",marketplace);
api.use("/properties",requireAuth,properties);
api.use("/",requireAuth,resources);
