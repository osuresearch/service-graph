
# Resource data model

Resources are composed of the following major pieces:

### ID

The ID for a resource must be **globally unique** across the research enterprise. Resources from multiple data sources will be merged for search indexing.

### Hierarchical Categorization

High level hierarchical categorization of the resource in the research enterprise. Supports up to 4 levels.

### Description

Human-readable high level description of the resource. This is split into two duplicate fields: `description` for rich text and `textDescription` for plain text. Only `textDescription` is indexed for full text search.

### Attributes

Dictionary of atomic values associated with this resource. Attributes are meant for searching, filtering, and faceting and **should not** include content details, such as form responses, if not applicable to a search use case.

Keys of the dictionary are meant to be human-readable for use with a wide range of search tooling. In some scenarios, these keys may be normalized to allow aggregation across slight variants.

For a list of supported atomic types, check out [@osuresearch/types](https://github.com/osuresearch/types).

### Examples

An NMR spectrometer. This example comes from the [Resource Catalog](https://orapps.osu.edu/catalog/resource/F067BBD9-C514-ED11-9466-005056A16F8D?).

```json
{
  "id": "F067BBD9-C514-ED11-9466-005056A16F8D",
  "name": "1.2 GHz NMR spectrometer",
  "categoryLvl1": "Instruments",
  "categoryLvl2": "NMR instrument",
  "description": "The <em>1.2 GHz</em> nuclear ...",
  "textDescription": "The 1.2 GHz nuclear ...",
  "attributes": {
    "Location": [
      {
        "type": "Reference",
        "id": "9869BBD9-C514-ED11-9466-005056A16F8D",
        "name": "National Gateway Ultrahigh Field NMR Center",
        "categoryLvl1": "Organizations",
        "categoryLvl2": "Core Laboratory",
        "source": "catalog",
      }
    ],
    "Part of Collection": [
      {
        "type": "Reference",
        "id": "616DBBD9-C514-ED11-9466-005056A16F8D",
        "name": "Dr. Vicki Wysocki Ohio Eminent Scholar Collection",
        "categoryLvl1": "Resource Collections",
        "source": "catalog",
      }
    ],
    "Funded by": [
      {
        "type": "Organization",
        "name": "National Science Foundation",
        "nickname": "NSF",
      }
    ],
    "Related grant number": [
      {
        "type": "Text",
        "text": "RI-1 123456",
      }
    ]
  }
}
```

A service for protocol development [(reference)](https://orapps.osu.edu/catalog/resource/639CB3DF-C514-ED11-9466-005056A16F8D)

```json
{
  "id": "639CB3DF-C514-ED11-9466-005056A16F8D",
  "name": "Protocol Development",
  "categoryLvl1": "Service",
  "categoryLvl2": "Support service",
  "description": "Assist with protocol development.",
  "textDescription": "Assist with protocol development.",
  "attributes": {
    "Location": [
      {
        "type": "Reference",
        "id": "669CB3DF-C514-ED11-9466-005056A16F8D",
        "name": "CCTS Comparative and Translational Medicine",
        "categorylvl1": "Organizations",
        "categorylvl2": "Core Laboratory",
        "source": "catalog",
      }
    ],
    "Website": [
      {
        "type": "Website",
        "website": "https://ccts.osu.edu/content/comparative-and-translational-medicine"
      }
    ]
  }
}
```

An IRB revision submitted for review

```json
{
  "id": "2025C0005-AM1",
  "categorylvl1": "OSU Cancer IRB",
  "categorylvl2": "2025B0005",
  "categorylvl3": "Amendment #1",
  "name": "A study in scarlet and red",
  "description": "Amendment to the objectives, research activities, and informed consent processes",
  "attributes": {
    "Review Group": [
      {
        "type": "Text",
        "text": "OSU Cancer IRB",
      }
    ],
    "Deadline": [
      {
        "type": "DateTime",
        "dateTime": "2024-04-05T00:00:00+0000",
      }
    ],
    "Protocol": [
      {
        "type": "Reference",
        "id": "2025C0005",
        "name": "2025C0005 - A study in scarlet and red",
        "source": "Buck-IRB",
      }
    ],
    "Principal Investigator": [
      {
        "type": "Person",
        "id": "132456789",
        "name": "Chase McManning",
        "nickname": "mcmanning.1",
      }
    ],
  }
}
```

An individual and their compliance training information:

```json
{
  "id": "OSUID200123456",
  "categorylvl1": "People",
  "name": "Chase McManning",
  "description": "Sr. enterprise applications developer for OSU Research",
  "attributes": {
    "Contact": [
      {
        "type": "Person",
        "id": "200123456",
        "name": "Chase McManning",
        "nickname": "mcmanning.1",
        "email": "mcmanning.1@osu.edu",
      }
    ],
    "Training": [
      {
        "type": "EducationalOccupationalCredential",
        "name": "CITI",
        "description": "The Collaborative Institutional Training Initiative (CITI Program) is dedicated to serving the training needs of colleges and universities, healthcare institutions, technology and research organizations, and governmental agencies, as they foster integrity and professional advancement of their learners.",
        "dateCreated": "2023-04-04T15:51:29+0000",
        "expires": "2024-04-04T00:00:00+0000"
      }
    ]
  }
}
```

# SQL table requirements

We expect a specific set of column names in order to transform SQL rows into OpenSearch resources.

The non-attribute fields are retrieved using the following column names:

```
id, name, description, textDescription,
categoryLvl1, categoryLvl2, categoryLvl3, categoryLvl4,
createdDate, updatedDate, deletedDate,
```

Attributes use JSON Path as column names to specify which field within an atomic you are writing to.

As an example, to insert a new `Text` atomic in the `Status` attribute, you would use the following column names:

```sql
select
  'Text' as '$.attributes.Status[0].type',
  'Incomplete' as '$.attributes.Status[0].text',
  ...
```

If you provide `null` as an atomic `type` then the entire atomic entry will be dropped before indexing.

You may also provide full JSON as the column value. This will automatically be transformed into the appropriate types. As an example, if you wanted to fetch user information from a separate table for a `Submitter` attribute, you could use the following:

```sql
select
  '$.attributes.Submitter' = (
    select
      'Person' as [type],
      n.id as [id],
      n.fullName as [name]
    from users u
    where u.id = s.submitterId
    for json auto
  ),
  ...
from
  submission s
```

If your source data does not meet this format, use a view or add triggers to populate a separate table.

## Full annotated example

Here's an example of a generic form (IRB, requisition, timesheet, etc) with the attributes:
1. Current submission status (e.g. unsubmitted, submitted, approved, etc)
2. Who submitted the form
3. Who needs to approve the form
4. Additional submitter notes that could be searched on
5. Due date for approval

```sql
select
  -- Summary information --
  submissionId as [id], -- GUID. Make sure this is unique across *all* resources
                        -- indexed across the enterprise
  s.title as [name],
  s.summary as [description],
  s.summary as [textDescription],

  -- Hierarchical categorization --

  -- Example: Office of Research > Forms > Equipment Rental
  s.[department] as [categoryLvl1],
  'Forms' as[categoryLvl2],
  s.[purpose] as [categoryLvl3],
  '' as [categoryLvl4],

  -- Dates --
  -- CRUD dates are not *indexing* dates but actual data modification dates.
  -- Since data can be reindexed on-demand, these dates must come from
  -- your source data. Make sure these are all ISO8601
  convert(varchar(19), s.createdDate, 126) as [createdDate],
  convert(varchar(19), s.updatedDate, 126) as [updatedDate],
  convert(varchar(19), s.deletedDate, 126) as [deletedDate]

  -- Attributes --

  -- Order matters! Earlier attributes are displayed before later
  -- ones in hit summaries *unless* the order is modified due to
  -- attribute relevancy matching with full text searches or faceting.

  -- You can supply atomics as JSON Path columns to each individual field.
  'Text' as '$.attributes.Status[0].type',
  s.[status] as '$.attributes.Status[0].text',

  -- Use null for an atomic type name to indicate that it should be ignored
  -- by the transformer, regardless of what the rest of the attribute fields are.
  iif(dueDate is null, null, 'DateTime') as '$.attributes.Due Date[0].type',
  convert(varchar(19), dueDate, 126) as '$.attributes.Due Date[0].dateTime'

  -- Types may still be constructed using JSON columns as long as the
  -- constructed type conforms to one of the @osuresearch/types atomics.
  -- The transformer will understand and convert if it's valid JSON.
  '$.attributes.Submitter' = (
    select
      'Person' as [type],
      n.id as [id],
      n.fullName as [name]
    from users u
    where u.id = s.submitterId
    for json auto
  ),

  '$.attributes.Approver' = (
    select
      'Person' as [type],
      n.id as [id],
      n.fullName as [name]
    from users u
    where u.id = s.approverId
    for json auto
  ),

  'Text' as '$.attributes.Group[0].type',
  s.reviewGroupId as '$.attributes.Group[0].text',

from
  Demo.dbo.Form f
```

# On-demand ETL

We provide a script for performing bulk ETLs from MSSQL -> OpenSearch for datasets. This is outside the typical API flow and may be used for non-AWS scheduled jobs or adhoc bulk indexing while testing new resource types.

Usage:

```
yarn ts-node packages/ingest/src/ondemand.ts your-index YourDb.dbo.YourTable
```

Where `your-index` is the resource index you want to use in OpenSearch and `YourDb.dbo.YourTable` is your SQL table or view to index.

# Using the Batch Queue

Instead of going through the GraphQL API, you can send a message directly to the batching queue on SQS that contains your target index, source table, and list of resource IDs to reindex. 

In PHP, this would look something like the following:

```php
<?php
$client = new SqsClient([
  'profile' => 'default',
  'region' => 'us-east-2',
  'version' => '2012-11-05'
]);

$params = [
  'MessageAttributes' => [
    // The index you want to write to.
    // If this does not exist it will be automatically
    // created using the standard mapping.
    'Index' => [
      'DataType' => 'String',
      'StringValue' => 'people-dev',
    ],
    // Source table or view to read from. 
    'Table' => [
      'DataType' => 'String',
      'StringValue' => 'MyDB.dbo.VW_Users'
    ],
    // Any other included attributes will be
    // logged alongside the indexing operation(s).
  ],

  // Provide a comma-delimited list of resource IDs
  // as your body for indexing. 
  // This queue does not support "index everything"
  // operations, so at least one ID is required. 
  'MessageBody' => '
    1,2,3,4,5
  ',
  'QueueUrl' => 'QUEUE_URL'
];

try {
  $result = $client->sendMessage($params);
  var_dump($result);
} 
catch (AwsException $e) {
  // Handle your error 
  error_log($e->getMessage());
}
```
