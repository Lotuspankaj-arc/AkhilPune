USE akhil_pune_bhavsar;

INSERT INTO teams (client_id, language_id, team_name, is_active)
SELECT client.client_id,
       (SELECT language_id FROM languages WHERE language_code = 'mr' LIMIT 1),
       seed.team_name,
       TRUE
FROM clients client
CROSS JOIN (
    SELECT 'विनीत / स्वागतोत्सुक व कार्यकारिणी समिती सदस्य' AS team_name
    UNION ALL SELECT 'समस्त भावसार क्षत्रिय महिला मंडळ'
    UNION ALL SELECT 'समस्त भावसार क्षत्रिय युवा परिषद'
    UNION ALL SELECT 'तांत्रिक सहाय्यता (Technical Helpline)'
    UNION ALL SELECT 'नोंदणी सहाय्यता हेल्पलाईन'
    UNION ALL SELECT 'स्मरणिका जाहिरात नियोजन समिती'
) seed
WHERE client.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM teams existing_team
      WHERE existing_team.client_id = client.client_id
        AND existing_team.team_name = seed.team_name
  );