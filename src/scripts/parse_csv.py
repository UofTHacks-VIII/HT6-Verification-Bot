import csv
import json

data = []

valid_roles = [
"verified",
  "hacker",
  "judge",
  "mentor",
  "workshop-host",
  "recruiter",
  "sponsor"
]

with open('sponsor_1.csv', 'r') as file:
  reader = csv.reader(file)

  for row in reader:
    company = row[0].strip()
    name = row[1].strip()
    email = row[2].lower()
    expiry = int(row[3].strip()) if row[3].strip() else None
    roles = row[4:]

    formatted_roles = []

    for r in roles:
      if r:
        r = r.lower().strip()

        formatted_roles.append(r)

        if r not in valid_roles:
          raise Exception('%s is not a valid role!' % r)
          break

    if company.strip():
      display_name = '%s (%s)' % (name.split()[0], company)
    else:
      display_name = name.strip()

    person = {
       'displayName': display_name.strip(),
       'email': email.strip(),
       'roles': formatted_roles
    }

    if expiry:
      person['expires'] = expiry

    data.append(person)

print(data)

with open('users.json', 'w') as file:
  json.dump(data, file, indent=4)
