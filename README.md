# Campus Walk

This is Web app that is intended for walking a school campus and record what is in every room. This is a fullstack app.

What to build:

- In the field: a way for the a user in the field to browse a Campus and to see it's buildings, floors, rooms and other items contained within. The primary ability to create assets and to move them, update them, and remove them and to attach other important data to them such as photos and notes. 

-In the Office: a way for an office user to see a summary of the above per campus with other useful summary metrics such as asset counts, items by condition level, and unassessed rooms. 

The data model is heirarchical Campus → Building → Floor → Room → Asset. 

# Data Model

    Campus: one-to-many with Building
    Building: 

    ```mermaid
  erDiagram
      CAMPUS ||--o{ BUILDING : contains
      BUILDING ||--o{ ASSESSMENT : "is assessed in"
      ASSESSOR ||--o{ ASSESSMENT : performs
      ASSESSMENT ||--o{ FINDING : records

      CAMPUS {
          int campus_id PK
          string name
          string address
      }
      BUILDING {
          int building_id PK
          int campus_id FK
          string name
          int year_built
      }
      ASSESSMENT {
          int assessment_id PK
          int building_id FK
          int assessor_id FK
          date walk_date
      }
      FINDING {
          int finding_id PK
          int assessment_id FK
          string category
          string severity
          string notes
      }
      ASSESSOR {
          int assessor_id PK
          string name
      }
  ```

## Tech Stack

TypeScript
next.js
relational DB, for this app Postgres
