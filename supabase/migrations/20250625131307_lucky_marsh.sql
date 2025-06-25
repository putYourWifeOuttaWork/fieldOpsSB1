-- Drop all existing versions of the create_submission_session function
DROP FUNCTION IF EXISTS create_submission_session(uuid, uuid, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS create_submission_session(uuid, uuid, jsonb, text, text, uuid);
DROP FUNCTION IF EXISTS create_submission_session(uuid, uuid, jsonb, text, text);

-- Create a single definitive version of the function
CREATE OR REPLACE FUNCTION create_submission_session(
  p_site_id UUID,
  p_program_id UUID,
  p_submission_data JSONB,
  p_petri_templates JSONB DEFAULT NULL,
  p_gasifier_templates JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission_id UUID;
  v_session_id UUID;
  v_petri_observation_id UUID;
  v_gasifier_observation_id UUID;
  v_petri_template JSONB;
  v_gasifier_template JSONB;
  v_session_status session_status_enum;
  v_result JSONB;
  v_error TEXT;
  v_petri_index INTEGER := 0;  -- Initialize index counter for petri observations
  v_gasifier_index INTEGER := 0;  -- Initialize index counter for gasifier observations
  v_petri_observations JSONB := '[]'::JSONB;  -- Array to hold created petri observations
  v_gasifier_observations JSONB := '[]'::JSONB;  -- Array to hold created gasifier observations
  v_created_observation RECORD;
BEGIN
  -- Check if site exists
  IF NOT EXISTS (SELECT 1 FROM sites WHERE site_id = p_site_id) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Site not found'
    );
  END IF;
  
  -- Create new submission
  INSERT INTO submissions (
    site_id,
    program_id,
    temperature,
    humidity,
    airflow,
    odor_distance,
    weather,
    notes,
    created_by,
    indoor_temperature,
    indoor_humidity,
    submission_timezone
  )
  VALUES (
    p_site_id,
    p_program_id,
    (p_submission_data->>'temperature')::NUMERIC,
    (p_submission_data->>'humidity')::NUMERIC,
    (p_submission_data->>'airflow')::airflow_enum,
    (p_submission_data->>'odor_distance')::odor_distance_enum,
    (p_submission_data->>'weather')::weather_enum,
    p_submission_data->>'notes',
    auth.uid(),
    CASE 
      WHEN p_submission_data ? 'indoor_temperature' AND p_submission_data->>'indoor_temperature' != '' 
      THEN (p_submission_data->>'indoor_temperature')::NUMERIC 
      ELSE NULL 
    END,
    CASE 
      WHEN p_submission_data ? 'indoor_humidity' AND p_submission_data->>'indoor_humidity' != '' 
      THEN (p_submission_data->>'indoor_humidity')::NUMERIC 
      ELSE NULL 
    END,
    p_submission_data->>'timezone'
  )
  RETURNING submission_id INTO v_submission_id;
  
  -- If petri templates are provided, create petri observations
  IF p_petri_templates IS NOT NULL AND jsonb_typeof(p_petri_templates) = 'array' THEN
    FOR v_petri_template IN SELECT * FROM jsonb_array_elements(p_petri_templates)
    LOOP
      INSERT INTO petri_observations (
        submission_id,
        site_id,
        petri_code,
        plant_type,
        fungicide_used,
        surrounding_water_schedule,
        placement,
        placement_dynamics,
        notes,
        order_index  -- Add order_index field here
      )
      VALUES (
        v_submission_id,
        p_site_id,
        v_petri_template->>'petri_code',
        COALESCE(v_petri_template->>'plant_type', 'Other Fresh Perishable')::plant_type_enum,
        (v_petri_template->>'fungicide_used')::fungicide_used_enum,
        (v_petri_template->>'surrounding_water_schedule')::water_schedule_enum,
        CASE 
          WHEN v_petri_template ? 'placement' AND v_petri_template->>'placement' != '' 
          THEN (v_petri_template->>'placement')::petri_placement_enum 
          ELSE NULL 
        END,
        CASE 
          WHEN v_petri_template ? 'placement_dynamics' AND v_petri_template->>'placement_dynamics' != '' 
          THEN (v_petri_template->>'placement_dynamics')::petri_placement_dynamics_enum 
          ELSE NULL 
        END,
        v_petri_template->>'notes',
        v_petri_index  -- Set the order_index to the current counter value
      )
      RETURNING observation_id INTO v_petri_observation_id;
      
      -- Fetch the created observation and add it to our array
      SELECT row_to_json(po) INTO v_created_observation
      FROM petri_observations po
      WHERE observation_id = v_petri_observation_id;
      
      -- Add to the petri observations array
      v_petri_observations := v_petri_observations || to_jsonb(v_created_observation);
      
      -- Increment the petri index counter
      v_petri_index := v_petri_index + 1;
    END LOOP;
  END IF;
  
  -- If gasifier templates are provided, create gasifier observations
  IF p_gasifier_templates IS NOT NULL AND jsonb_typeof(p_gasifier_templates) = 'array' THEN
    FOR v_gasifier_template IN SELECT * FROM jsonb_array_elements(p_gasifier_templates)
    LOOP
      INSERT INTO gasifier_observations (
        submission_id,
        site_id,
        gasifier_code,
        chemical_type,
        anomaly,
        placement_height,
        directional_placement,
        placement_strategy,
        notes,
        order_index  -- Add order_index field here
      )
      VALUES (
        v_submission_id,
        p_site_id,
        v_gasifier_template->>'gasifier_code',
        (v_gasifier_template->>'chemical_type')::chemical_type_enum,
        COALESCE((v_gasifier_template->>'anomaly')::BOOLEAN, FALSE),
        CASE 
          WHEN v_gasifier_template ? 'placement_height' AND v_gasifier_template->>'placement_height' != '' 
          THEN (v_gasifier_template->>'placement_height')::placement_height_enum 
          ELSE NULL 
        END,
        CASE 
          WHEN v_gasifier_template ? 'directional_placement' AND v_gasifier_template->>'directional_placement' != '' 
          THEN (v_gasifier_template->>'directional_placement')::directional_placement_enum 
          ELSE NULL 
        END,
        CASE 
          WHEN v_gasifier_template ? 'placement_strategy' AND v_gasifier_template->>'placement_strategy' != '' 
          THEN (v_gasifier_template->>'placement_strategy')::placement_strategy_enum 
          ELSE NULL 
        END,
        v_gasifier_template->>'notes',
        v_gasifier_index  -- Set the order_index to the current counter value
      )
      RETURNING observation_id INTO v_gasifier_observation_id;
      
      -- Fetch the created observation and add it to our array
      SELECT row_to_json(go) INTO v_created_observation
      FROM gasifier_observations go
      WHERE observation_id = v_gasifier_observation_id;
      
      -- Add to the gasifier observations array
      v_gasifier_observations := v_gasifier_observations || to_jsonb(v_created_observation);
      
      -- Increment the gasifier index counter
      v_gasifier_index := v_gasifier_index + 1;
    END LOOP;
  END IF;
  
  -- Create a submission session
  v_session_status := 'Opened'::session_status_enum;
  
  INSERT INTO submission_sessions (
    submission_id,
    site_id,
    program_id,
    opened_by_user_id,
    session_status
  )
  VALUES (
    v_submission_id,
    p_site_id,
    p_program_id,
    auth.uid(),
    v_session_status
  )
  RETURNING session_id INTO v_session_id;
  
  -- Return success response with IDs and observations
  v_result := jsonb_build_object(
    'success', TRUE,
    'submission_id', v_submission_id,
    'session_id', v_session_id,
    'petri_observations', v_petri_observations,
    'gasifier_observations', v_gasifier_observations
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', SQLERRM,
      'detail', v_error
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_submission_session(UUID, UUID, JSONB, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION create_submission_session(UUID, UUID, JSONB, JSONB, JSONB) IS 'Creates a new submission with associated observations and a session, using JSONB for all template parameters to prevent ambiguity.';