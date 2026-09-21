import { Router } from "express";
import { supabase } from "../config/supabase.js";
const router=Router();
router.get("/settings",async(req,res)=>{const {data,error}=await supabase.from("profiles").select("*").eq("id",req.user!.id).single(); if(error)throw error; res.json({data});});
router.patch("/settings",async(req,res)=>{const allowed=((({full_name,phone,address}:any)=>({full_name,phone,address})))(req.body); const {data,error}=await supabase.from("profiles").update(allowed).eq("id",req.user!.id).select().single(); if(error)throw error; res.json({data});});
export default router;
