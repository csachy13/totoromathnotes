/**
 * Auth router - Server only
 */
import { z } from "zod";
import { router, guestProcedure, publicProcedure } from "~/server";
import { authorizationService } from "~/lib/services";
import { PermissionIdentifier, validatePermissionId } from "@repo/db";

// Create a Zod schema for permission identifier
const permissionIdentifierSchema = z.string().refine(
  (val): val is PermissionIdentifier => {
    return validatePermissionId(val);
  },
  {
    message:
      "Invalid permission identifier format. Expected format: module:resource:action",
  }
);

export const authRouter = router({
  // Get the current user's permissions
  getMyPermissions: publicProcedure.query(async ({ ctx }) => {
    let userId = undefined;
    if (ctx.session) {
      userId = parseInt(ctx.session.user.id);
    }

    // Get all permissions for the current user
    if (!userId) {
      // Handle guest users by returning default permissions
      return {
        permissions: [],
        permissionNames: [],
        permissionMap: {},
      };
    }

    try {
      const permissionsWithRelations =
        await authorizationService.getUserPermissions(userId);

      return {
        permissions: permissionsWithRelations,
        permissionNames: permissionsWithRelations.map((p) => {
          const moduleName = p.module?.name ?? "unknown-module";
          const actionName = p.action?.name ?? "unknown-action";
          return `${moduleName}:${p.resource}:${actionName}` as PermissionIdentifier;
        }),
        permissionMap: permissionsWithRelations.reduce((acc, p) => {
          const moduleName = p.module?.name;
          const actionName = p.action?.name;
          if (moduleName && actionName) {
            acc[`${moduleName}:${p.resource}:${actionName}`] = true;
          }
          return acc;
        }, {} as Record<PermissionIdentifier, boolean>),
      };
    } catch (error) {
      // Log error and return default permissions
      console.error("Error fetching permissions:", error);
      return {
        permissions: [],
        permissionNames: [],
        permissionMap: {},
      };
    }
  }),

  // Check if the current user has a specific permission
  hasPermission: guestProcedure
    .input(z.object({ permission: permissionIdentifierSchema }))
    .query(async ({ ctx, input }) => {
      const userId = parseInt(ctx.session.user.id);
      const hasPermission = await authorizationService.hasPermission(
        userId,
        input.permission
      );
      return hasPermission;
    }),

  // Check if the current user has any of the specified permissions
  hasAnyPermission: guestProcedure
    .input(z.object({ permissions: z.array(permissionIdentifierSchema) }))
    .query(async ({ ctx, input }) => {
      const userId = parseInt(ctx.session.user.id);
      const hasAnyPermission = await authorizationService.hasAnyPermission(
        userId,
        input.permissions
      );
      return hasAnyPermission;
    }),

  // Check if the current user has access to a specific page
  hasPagePermission: guestProcedure
    .input(
      z.object({
        pageId: z.number(),
        permission: permissionIdentifierSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = parseInt(ctx.session.user.id);
      const hasPermission = await authorizationService.hasPagePermission(
        userId,
        input.pageId,
        input.permission
      );
      return hasPermission;
    }),

  /*
   * Get permissions for guest users
   * @deprecated Use getMyPermissions instead
   */
  getGuestPermissions: guestProcedure
    .meta({
      description: "Get permissions for guest users",
    })
    .query(async () => {
      // Get guest permissions using the authorization service
      const guestGroupId = await authorizationService.getGuestGroupId();

      if (!guestGroupId) {
        // Return empty permissions if no guest group defined
        return {
          permissions: [],
          permissionNames: [],
          permissionMap: {},
        };
      }

      // Guest users have userId undefined
      const permissionsWithRelations =
        await authorizationService.getUserPermissions(undefined);

      // Collect permission names
      const permissionNames = permissionsWithRelations.map((p) => {
        const moduleName = p.module?.name ?? "unknown-module";
        const actionName = p.action?.name ?? "unknown-action";
        return `${moduleName}:${p.resource}:${actionName}` as PermissionIdentifier;
      });

      // Create a map for easy lookup
      const permissionMap = permissionsWithRelations.reduce(
        (acc, permission) => {
          const moduleName = permission.module?.name;
          const actionName = permission.action?.name;
          if (moduleName && actionName) {
            const name = `${moduleName}:${permission.resource}:${actionName}`;
            if (validatePermissionId(name)) {
              acc[name as PermissionIdentifier] = true;
            }
          }
          return acc;
        },
        {} as Record<PermissionIdentifier, boolean>
      );

      return {
        permissions: permissionsWithRelations,
        permissionNames,
        permissionMap,
      };
    }),
});
