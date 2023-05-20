import { Atom } from '@osuresearch/types';
import { connect as OSConnect, disconnect as OSDisconnect, rebuild, bulk } from './opensearch';
import { connect as MSSQLConnect, disconnect as MSSQLDisconnect, batch } from './mssql';
import { Resource } from './types';
import { containsValidAtoms, toFacet, toSearchable } from './transformers';
import { updateObjectByJSONPath } from './utils';

/**
 * Utility to fully rebuild
 *
 * Assumes a specific format for columns.
 * Documentation... eventually.
 *
 * @param index
 * @param table
 */
export async function bulkRebuild(
  index: string,
  table: string
) {
  // Rebuild OpenSearch index from scratch.
  // This assumes no incremental updates
  await rebuild(index);

  // Pull down everything unfiltered.
  const query = `SELECT * FROM ${table}`;

  return batchFromQuery(index, query);
}

function isValidUUIDv4(uuid: string) {
  return uuid.match(
    /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i
  );
}

/**
 * Utility to upsert one or more resources by ID into the given index.
 *
 * @param index
 * @param table
 * @param ids
 */
export async function bulkUpsert(
  index: string,
  table: string,
  uuids: string[]
) {
  // Note there's not a good solution in 2023 (still...)
  // for handling IN clauses with string IDs so I sanitize it here.
  // Ref: https://github.com/tediousjs/node-mssql/issues/313
  const sanitizedIds = uuids.filter(isValidUUIDv4).join("','");
  if (sanitizedIds.length < 1) {
    return;
  }

  const query = `SELECT * FROM ${table} WHERE [id] IN ('` + sanitizedIds + `')`;

  return batchFromQuery(index, query);
}

async function batchFromQuery(index: string, query: string) {

  try {
    // Your typical ETL:
    //  read batches of rows from SQL
    //  transform them into Resources for indexing
    //  bulk index them into OpenSearch.
    await batch(query, async (rows) => {
      const resources = rows.map<Resource>((row) => {

        const {
          id,
          name,
          description,
          textDescription,
          categoryLvl1,
          categoryLvl2,
          categoryLvl3,
          categoryLvl4,
          createdDate,
          updatedDate,
          deletedDate
        } = row;

        const resource: Resource = {
          id,
          name,
          description,
          textDescription,

          categoryLvl1,
          categoryLvl2,
          categoryLvl3,
          categoryLvl4,

          createdDate,
          updatedDate,
          deletedDate,

          attributes: {},

          facets: {},
          facetNames: [],

          searchables: {},
          searchableNames: [],
        };

        // Extract attributes as JSON paths.
        Object.keys(row).forEach((key) => {
          if (key.startsWith('$')) {
            updateObjectByJSONPath(key, resource, row[key]);
          }
        });

        // Scrub invalid attributes.
        Object.keys(resource.attributes).forEach((name) => {
          if (!containsValidAtoms(resource.attributes[name])) {
            delete resource.attributes[name];
          }
        })

        // Convert attributes into facets and full text searchables
        Object.keys(resource.attributes).forEach((name) => {
          let searchables: string[] = [];
          let facets: string[] = [];

          // Transform each attribute value into a facet and a searchable
          resource.attributes[name]?.forEach((atom: Atom) => {
            searchables = [...searchables, ...toSearchable(atom)];

            const facet = toFacet(atom);
            if (facet) {
              facets = [...facets, facet];
            }
          });

          if (facets.length > 0) {
            resource.facets[name] = facets;
          }

          if (searchables.length > 0) {
            resource.searchables[name] = searchables;
          }
        });

        resource.facetNames = Object.keys(resource.facets);
        resource.searchableNames = Object.keys(resource.searchables);

        console.log(JSON.stringify(resource, undefined, 2));
        return resource;
      });

      await bulk(index, resources);
    });
  }
  catch (e) {
    console.error(e);
    throw e;
  }
  finally {
    console.log('disconnect services');
    OSDisconnect();
    MSSQLDisconnect();
  }
}
