// Fill these in after creating your Supabase project (see README.md).
// The anon key is meant to be public. Never put the service_role key here.
window.RF_CONFIG = {
  SUPABASE_URL: "https://jowqfqtwqcpcmcfpxqoy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvd3FmcXR3cWNwY21jZnB4cW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjI4MDQsImV4cCI6MjEwNzQ5ODgwNH0.2v-OBNvR4xHrOjfO4N4SJ_5y9KgCYsnXesAbZcvC3hA",
  BUSINESS: {
    name: "Rolva Finance Technologies",
    phone: "+27713387578",
    whatsapp: "+27713387578",   // digits only, with country code, e.g. 27821234567
    email: "mashalerolva@gmail.com",
    address: "South Africa, Gauteng, Johannesburg",
    ncr: "2026 / 792595 / 07"         // your NCR registration number (NCRCP...)
  },
  // Optional. Fill these in to show a cost calculator on the home page.
  // Leave interestPercent empty to hide it.
  LOAN: {
    interestPercent: "",     // interest as % of the amount borrowed
    initiationFee: "",       // rand, one-off
    serviceFeePerMonth: "",  // rand per month
    minAmount: "",
    maxAmount: "",
    minDays: "",
    maxDays: ""
  }
};
