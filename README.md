
# 🍱 Service Graph

A monorepo of GraphQL services built on AWS.

**⚠ This is not production ready**

## Included services

>This repository **does not** contain application domain services used by the Office of Research.

### Gateway service

Discovers and catalogs supported GraphQL microservices within AWS and provides a centralized federated gateway for handling authentication, authorization, health checking, and asynchronous cross-service request fulfillment.

### Person service

Resolver for the `Person` agent data type ubiquitous across all services to provide names, emails, and contact information.

This serves as a simple example of a microservice that is used heavily across multiple services for resolving individuals associated with other data.

### Ingest service

Bulk and incremental resource indexer for OpenSearch.

Handles indexing of all application resources into a standardized format so that frontend components may perform enterprise-wide searches using a standard set of rules and data types.

### Search service

Search and filter resources indexed by the Ingest service by providing APIs compatible with [InstantSearch.js](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/js/).


## Authors and license

[Chase McManning](https://github.com/McManning) and [contributors](https://github.com/osuresearch/ripple/graphs/contributors).

MIT License, see the included [LICENSE](LICENSE.md) file.
