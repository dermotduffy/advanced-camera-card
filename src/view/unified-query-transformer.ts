import { CameraQueryClassifier } from '../camera-manager/manager';
import { QuerySource } from '../query-source';
import { UnifiedQuery } from './unified-query';

interface RebuildOptions {
  start?: Date;
  end?: Date;
  limit?: number;
}

/**
 * Static utility methods for cloning and transforming existing UnifiedQuery
 * objects. Unlike UnifiedQueryBuilder, these don't require state (e.g. a
 * CameraManager).
 */
export class UnifiedQueryTransformer {
  static stripTimeRange(query: UnifiedQuery): UnifiedQuery {
    const nodes = query.getNodes().map((node) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { start, end, ...rest } = node;
      return rest;
    });
    return new UnifiedQuery(nodes);
  }

  static rebuildQuery(query: UnifiedQuery, options: RebuildOptions): UnifiedQuery {
    const timeRange = {
      ...(options.start && { start: options.start }),
      ...(options.end && { end: options.end }),
    };
    const nodes = query.getNodes().map((node) => ({
      ...node,
      ...timeRange,
      // Folder queries do not support a limit.
      ...(node.source === QuerySource.Camera &&
        options.limit !== undefined && { limit: options.limit }),
    }));
    return new UnifiedQuery(nodes);
  }

  static convertToClips(query: UnifiedQuery): UnifiedQuery {
    const nodes = query
      .getNodes()
      .map((node) =>
        node.source === QuerySource.Camera && CameraQueryClassifier.isEventQuery(node)
          ? { ...node, hasClip: true, hasSnapshot: undefined }
          : node,
      );
    return new UnifiedQuery(nodes);
  }
}
