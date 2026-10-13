// Fill these in after creating your Supabase project (see README.md).
// The anon key is meant to be public. Never put the service_role key here.
window.RF_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  BUSINESS: {
    name: "Rolva Finance Technologies",
    phone: "",
    whatsapp: "",   // digits only, with country code, e.g. 27821234567
    email: "",
    address: "",
    ncr: ""         // your NCR registration number (NCRCP...)
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
