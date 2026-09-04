import type { NextFunction, Request, Response } from "express";
import { supabase } from "../config/supabase.js";
declare global { namespace Express { interface Request { user?: { id:string; email?:string } } } }
export async function requireAuth(req:Request,res:Response,next:NextFunction){
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,"");
  if(!token) return res.status(401).json({message:"Authentication required"});
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data.user) return res.status(401).json({message:"Invalid session"});
  req.user={id:data.user.id,email:data.user.email}; next();
}
