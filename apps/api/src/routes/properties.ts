import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/supabase.js";
const router=Router();
const propertySchema=z.object({name:z.string().min(2),address:z.string().min(5),monthly_rent:z.number().nonnegative(),images:z.array(z.string().url()).min(1).max(8),is_published:z.boolean().default(false)});
router.get("/",async(req,res)=>{const {data,error}=await supabase.from("properties").select("*").eq("landlord_id",req.user!.id).order("created_at",{ascending:false}); if(error) throw error; res.json({data});});
router.post("/",async(req,res)=>{const input=propertySchema.parse(req.body); const {count}=await supabase.from("properties").select("id",{count:"exact",head:true}).eq("landlord_id",req.user!.id); const {data:profile}=await supabase.from("profiles").select("plan").eq("id",req.user!.id).single(); if(profile?.plan!=="premium"&&(count??0)>=2)return res.status(403).json({message:"Free plan supports up to two properties"}); const {data,error}=await supabase.from("properties").insert({...input,landlord_id:req.user!.id}).select().single(); if(error)throw error; res.status(201).json({data});});
export default router;
