-- Migration v10: add standalone ODE solver types to calculation_type enum
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'ode_general';
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'ode_ivp';
ALTER TYPE calculation_type ADD VALUE IF NOT EXISTS 'ode_bvp';
