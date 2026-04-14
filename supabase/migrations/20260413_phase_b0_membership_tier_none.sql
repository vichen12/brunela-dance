-- Brunela Dance Trainer
-- Phase B0: extend membership_tier enum with a neutral no-access state.
-- Important: run this as a standalone statement before Phase B.

alter type public.membership_tier
add value 'none';
