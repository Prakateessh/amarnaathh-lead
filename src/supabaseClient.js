import { createClient } from '@supabase/supabase-js'

// REPLACE these with the actual values from your Supabase Dashboard (Project Settings -> API)
const supabaseUrl = 'https://aphjcejujhzhauktbmyw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwaGpjZWp1amh6aGF1a3RibXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTQ0ODUsImV4cCI6MjA5NTI3MDQ4NX0.BwYn4BoAAEXbF08uO2TNzbe7lgZFOEgSd2kVS2pSQHE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)