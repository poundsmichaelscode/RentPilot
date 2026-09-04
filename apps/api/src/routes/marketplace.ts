import { Router } from "express";
import { supabase } from "../config/supabase.js";
const router=Router();
router.get("/",async(req,res)=>{let query=supabase.from("properties").select("id,name,address,monthly_rent,images,landlord_id,profiles!properties_landlord_id_fkey(full_name,phone)").eq("is_published",true); if(req.query.q)query=query.ilike("address",`%${String(req.query.q)}%`); const {data,error}=await query.order("created_at",{ascending:false}); if(error)throw error; res.json({data});});
export default router;
