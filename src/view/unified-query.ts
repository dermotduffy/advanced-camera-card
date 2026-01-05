import cloneDeep from 'lodash-es/cloneDeep.js';
import isEqual from 'lodash-es/isEqual.js';
import omit from 'lodash-es/omit.js';
import { EventQuery, MediaQuery, QueryType } from '../camera-manager/types.js';
import { FolderQuery } from '../card-controller/folders/types.js';
import { QuerySource } from '../query-source.js';
import { ViewMediaType } from '../types.js';

export type QueryNode = MediaQuery | FolderQuery;

export class UnifiedQuery {
  private _nodes: QueryNode[];

  constructor(nodes?: QueryNode[]) {
    this._nodes = nodes ? [...nodes] : [];
  }

  public addNode(node: QueryNode): this {
    this._nodes.push(node);
    return this;
  }

  public getNodes(): QueryNode[] {
    return this._nodes;
  }

  public getNodeCount(): number {
    return this._nodes.length;
  }

  public hasNodes(): boolean {
    return this._nodes.length > 0;
  }

  public getMediaQueries<T extends MediaQuery = MediaQuery>(options?: {
    cameraID?: string;
    type?: QueryType;
  }): T[] {
    return this._nodes.filter((node): node is T => {
      if (!this._isMediaQuery(node)) {
        return false;
      }
      if (options?.cameraID && !node.cameraIDs.has(options.cameraID)) {
        return false;
      }
      if (options?.type && node.type !== options.type) {
        return false;
      }
      return true;
    });
  }

  public getFolderQueries(folderID?: string): FolderQuery[] {
    return this._nodes.filter(
      (node): node is FolderQuery =>
        this._isFolderQuery(node) && (!folderID || node.folder.id === folderID),
    );
  }

  public getNonMediaQueries(): QueryNode[] {
    return this._nodes.filter((node) => !this._isMediaQuery(node));
  }

  public hasMediaQueriesOfType(type: QueryType): boolean {
    return this._nodes.some((node) => this._isMediaQuery(node) && node.type === type);
  }

  public getAllCameraIDs(): Set<string> {
    const cameraIDs = new Set<string>();
    for (const node of this._nodes) {
      if (this._isMediaQuery(node)) {
        for (const id of node.cameraIDs) {
          cameraIDs.add(id);
        }
      }
    }
    return cameraIDs;
  }

  public getAllMediaTypes(): Set<ViewMediaType> {
    const types = new Set<ViewMediaType>();
    for (const node of this._nodes) {
      if (this._isMediaQuery(node)) {
        if (node.type === QueryType.Event) {
          const eventQuery = node as EventQuery;
          if (eventQuery.hasClip) {
            types.add('clips');
          }
          if (eventQuery.hasSnapshot) {
            types.add('snapshots');
          }
        } else if (node.type === QueryType.Recording) {
          types.add('recordings');
        } else if (node.type === QueryType.Review) {
          types.add('reviews');
        }
      }
    }
    return types;
  }

  public clone(): UnifiedQuery {
    return new UnifiedQuery(cloneDeep(this._nodes));
  }

  public isEqual(that: UnifiedQuery): boolean {
    return isEqual(this._nodes, that._nodes);
  }

  /**
   * Check if this query is a superset of another query.
   * A query is a superset if it covers at least all the queries of the other.
   * For media queries, this means same cameras/type and time range encompasses.
   */
  public isSupersetOf(that: UnifiedQuery): boolean {
    const nodeCovers = (thisNode: QueryNode, thatNode: QueryNode): boolean => {
      if (this._isMediaQuery(thatNode) && this._isMediaQuery(thisNode)) {
        const stripTimeRange = (query: MediaQuery) => omit(query, ['start', 'end']);
        return (
          isEqual(stripTimeRange(thisNode), stripTimeRange(thatNode)) &&
          timeRangeCovers(thisNode, thatNode)
        );
      }
      return isEqual(thisNode, thatNode);
    };

    const timeRangeCovers = (
      source: { start?: Date; end?: Date },
      target: { start?: Date; end?: Date },
    ): boolean => {
      const boundaryCovers = (
        compare: (s: Date, t: Date) => boolean,
        sourceBound?: Date,
        targetBound?: Date,
      ): boolean => {
        if (!targetBound) {
          // Unbounded target requires unbounded source
          return !sourceBound;
        }
        // Bounded target: source must be unbounded or extend at least as far
        return !sourceBound || compare(sourceBound, targetBound);
      };

      return (
        boundaryCovers((s, t) => s <= t, source.start, target.start) &&
        boundaryCovers((s, t) => s >= t, source.end, target.end)
      );
    };

    return that._nodes.every((thatNode) =>
      this._nodes.some((thisNode) => nodeCovers(thisNode, thatNode)),
    );
  }

  private _isMediaQuery(node: QueryNode): node is MediaQuery {
    return node.source === QuerySource.Camera;
  }

  private _isFolderQuery(node: QueryNode): node is FolderQuery {
    return node.source === QuerySource.Folder;
  }
}
