import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Application {
  id: string;
  email: string;
  university_name: string;
  deadline_date: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting reminder email check...");

    // Calculate dates for 7, 3, and 1 days from now
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(today.getDate() + 1);

    // Format dates for SQL query (YYYY-MM-DD)
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Get applications with deadlines in 7, 3, or 1 days
    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .in('deadline_date', [
        formatDate(sevenDaysFromNow),
        formatDate(threeDaysFromNow),
        formatDate(oneDayFromNow)
      ]);

    if (error) {
      console.error('Error fetching applications:', error);
      throw error;
    }

    console.log(`Found ${applications?.length || 0} applications with upcoming deadlines`);

    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No applications with upcoming deadlines found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Send emails for each application
    const emailPromises = applications.map(async (app: Application) => {
      const deadlineDate = new Date(app.deadline_date);
      const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let subject = "";
      let urgencyMessage = "";
      
      if (daysUntil === 7) {
        subject = `Reminder: ${app.university_name} Application Due in 1 Week`;
        urgencyMessage = "You have **1 week** to complete your application.";
      } else if (daysUntil === 3) {
        subject = `Urgent: ${app.university_name} Application Due in 3 Days`;
        urgencyMessage = "⚠️ **URGENT:** Only **3 days** remaining to submit your application!";
      } else if (daysUntil === 1) {
        subject = `FINAL REMINDER: ${app.university_name} Application Due Tomorrow`;
        urgencyMessage = "🚨 **FINAL NOTICE:** Your application is due **TOMORROW**!";
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Application Deadline Reminder</h2>
          
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 15px;">
            Dear Student,
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 15px;">
            ${urgencyMessage}
          </p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <strong>University:</strong> ${app.university_name}<br>
            <strong>Application Deadline:</strong> ${deadlineDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 15px;">
            Please make sure to complete and submit your application before the deadline to avoid missing this opportunity.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Best regards,<br>
            Academic Support Team
          </p>
        </div>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "Academic Support <a.hristov26@acsbg.org>",
          to: [app.email],
          subject: subject,
          html: html,
        });

        console.log(`Email sent successfully to ${app.email} for ${app.university_name}:`, emailResponse);
        return { success: true, email: app.email, university: app.university_name };
      } catch (emailError) {
        console.error(`Failed to send email to ${app.email}:`, emailError);
        return { success: false, email: app.email, university: app.university_name, error: emailError.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Email sending complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: "Reminder emails processed",
        successful,
        failed,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Error in send-reminder-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
};

serve(serve_handler);