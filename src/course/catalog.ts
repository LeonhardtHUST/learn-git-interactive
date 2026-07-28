/**
 * 课程资源静态目录。
 *
 * 以 text import 引入，开发模式与编译后的单文件程序都使用同一份 YAML 文本，
 * 再由 loader 统一做 YAML/Zod 校验。
 */
import courseZhCN from "../../courses/zh-CN/course.yaml" with { type: "text" };
import ch01_start_chapter from "../../courses/zh-CN/ch01-start/chapter.yaml" with { type: "text" };
import ch01_start_01_config_yaml from "../../courses/zh-CN/ch01-start/01-config.yaml" with {
  type: "text",
};
import ch01_start_02_init_yaml from "../../courses/zh-CN/ch01-start/02-init.yaml" with {
  type: "text",
};
import ch01_start_03_first_commit_yaml from "../../courses/zh-CN/ch01-start/03-first-commit.yaml" with {
  type: "text",
};
import ch02_basics_chapter from "../../courses/zh-CN/ch02-basics/chapter.yaml" with {
  type: "text",
};
import ch02_basics_01_track_file_yaml from "../../courses/zh-CN/ch02-basics/01-track-file.yaml" with {
  type: "text",
};
import ch02_basics_02_staging_yaml from "../../courses/zh-CN/ch02-basics/02-staging.yaml" with {
  type: "text",
};
import ch02_basics_03_gitignore_yaml from "../../courses/zh-CN/ch02-basics/03-gitignore.yaml" with {
  type: "text",
};
import ch02_basics_04_diff_yaml from "../../courses/zh-CN/ch02-basics/04-diff.yaml" with {
  type: "text",
};
import ch02_basics_05_log_tag_yaml from "../../courses/zh-CN/ch02-basics/05-log-tag.yaml" with {
  type: "text",
};
import ch02_basics_06_amend_yaml from "../../courses/zh-CN/ch02-basics/06-amend.yaml" with {
  type: "text",
};
import ch02_basics_07_restore_yaml from "../../courses/zh-CN/ch02-basics/07-restore.yaml" with {
  type: "text",
};
import ch02_basics_08_unstage_yaml from "../../courses/zh-CN/ch02-basics/08-unstage.yaml" with {
  type: "text",
};
import ch02_basics_09_revert_yaml from "../../courses/zh-CN/ch02-basics/09-revert.yaml" with {
  type: "text",
};
import ch02_basics_10_tag_yaml from "../../courses/zh-CN/ch02-basics/10-tag.yaml" with {
  type: "text",
};
import ch02_basics_11_alias_yaml from "../../courses/zh-CN/ch02-basics/11-alias.yaml" with {
  type: "text",
};
import ch03_branch_chapter from "../../courses/zh-CN/ch03-branch/chapter.yaml" with {
  type: "text",
};
import ch03_branch_01_create_switch_yaml from "../../courses/zh-CN/ch03-branch/01-create-switch.yaml" with {
  type: "text",
};
import ch03_branch_02_merge_yaml from "../../courses/zh-CN/ch03-branch/02-merge.yaml" with {
  type: "text",
};
import ch03_branch_03_conflict_yaml from "../../courses/zh-CN/ch03-branch/03-conflict.yaml" with {
  type: "text",
};
import ch03_branch_04_push_yaml from "../../courses/zh-CN/ch03-branch/04-push.yaml" with {
  type: "text",
};
import ch03_branch_05_pull_yaml from "../../courses/zh-CN/ch03-branch/05-pull.yaml" with {
  type: "text",
};
import ch03_branch_06_rebase_yaml from "../../courses/zh-CN/ch03-branch/06-rebase.yaml" with {
  type: "text",
};
import ch04_protocol_chapter from "../../courses/zh-CN/ch04-protocol/chapter.yaml" with {
  type: "text",
};
import ch04_protocol_01_local_clone_yaml from "../../courses/zh-CN/ch04-protocol/01-local-clone.yaml" with {
  type: "text",
};
import ch04_protocol_02_remote_branches_yaml from "../../courses/zh-CN/ch04-protocol/02-remote-branches.yaml" with {
  type: "text",
};
import ch05_distributed_chapter from "../../courses/zh-CN/ch05-distributed/chapter.yaml" with {
  type: "text",
};
import ch05_distributed_01_feature_branch_yaml from "../../courses/zh-CN/ch05-distributed/01-feature-branch.yaml" with {
  type: "text",
};
import ch05_distributed_02_integrate_yaml from "../../courses/zh-CN/ch05-distributed/02-integrate.yaml" with {
  type: "text",
};
import ch06_github_chapter from "../../courses/zh-CN/ch06-github/chapter.yaml" with {
  type: "text",
};
import ch06_github_01_fork_sync_yaml from "../../courses/zh-CN/ch06-github/01-fork-sync.yaml" with {
  type: "text",
};
import ch06_github_02_pr_merge_yaml from "../../courses/zh-CN/ch06-github/02-pr-merge.yaml" with {
  type: "text",
};
import ch07_tools_chapter from "../../courses/zh-CN/ch07-tools/chapter.yaml" with { type: "text" };
import ch07_tools_01_reflog_yaml from "../../courses/zh-CN/ch07-tools/01-reflog.yaml" with {
  type: "text",
};
import ch07_tools_02_stash_yaml from "../../courses/zh-CN/ch07-tools/02-stash.yaml" with {
  type: "text",
};
import ch08_config_chapter from "../../courses/zh-CN/ch08-config/chapter.yaml" with {
  type: "text",
};
import ch08_config_01_alias_yaml from "../../courses/zh-CN/ch08-config/01-alias.yaml" with {
  type: "text",
};
import ch08_config_02_quotepath_yaml from "../../courses/zh-CN/ch08-config/02-quotepath.yaml" with {
  type: "text",
};
import ch09_migration_chapter from "../../courses/zh-CN/ch09-migration/chapter.yaml" with {
  type: "text",
};
import ch09_migration_01_export_bundle_yaml from "../../courses/zh-CN/ch09-migration/01-export-bundle.yaml" with {
  type: "text",
};
import ch09_migration_02_import_bundle_yaml from "../../courses/zh-CN/ch09-migration/02-import-bundle.yaml" with {
  type: "text",
};
import ch10_internals_chapter from "../../courses/zh-CN/ch10-internals/chapter.yaml" with {
  type: "text",
};
import ch10_internals_01_blob_tree_yaml from "../../courses/zh-CN/ch10-internals/01-blob-tree.yaml" with {
  type: "text",
};
import ch10_internals_02_commit_tag_yaml from "../../courses/zh-CN/ch10-internals/02-commit-tag.yaml" with {
  type: "text",
};

export interface CatalogChapter {
  chapter: string;
  lessons: Record<string, string>;
}

export interface CourseCatalog {
  course: string;
  chapters: Record<string, CatalogChapter>;
}

export const COURSE_CATALOG: Record<"zh-CN", CourseCatalog> = {
  "zh-CN": {
    course: courseZhCN,
    chapters: {
      "ch01-start": {
        chapter: ch01_start_chapter,
        lessons: {
          "01-config.yaml": ch01_start_01_config_yaml,
          "02-init.yaml": ch01_start_02_init_yaml,
          "03-first-commit.yaml": ch01_start_03_first_commit_yaml,
        },
      },
      "ch02-basics": {
        chapter: ch02_basics_chapter,
        lessons: {
          "01-track-file.yaml": ch02_basics_01_track_file_yaml,
          "02-staging.yaml": ch02_basics_02_staging_yaml,
          "03-gitignore.yaml": ch02_basics_03_gitignore_yaml,
          "04-diff.yaml": ch02_basics_04_diff_yaml,
          "05-log-tag.yaml": ch02_basics_05_log_tag_yaml,
          "06-amend.yaml": ch02_basics_06_amend_yaml,
          "07-restore.yaml": ch02_basics_07_restore_yaml,
          "08-unstage.yaml": ch02_basics_08_unstage_yaml,
          "09-revert.yaml": ch02_basics_09_revert_yaml,
          "10-tag.yaml": ch02_basics_10_tag_yaml,
          "11-alias.yaml": ch02_basics_11_alias_yaml,
        },
      },
      "ch03-branch": {
        chapter: ch03_branch_chapter,
        lessons: {
          "01-create-switch.yaml": ch03_branch_01_create_switch_yaml,
          "02-merge.yaml": ch03_branch_02_merge_yaml,
          "03-conflict.yaml": ch03_branch_03_conflict_yaml,
          "04-push.yaml": ch03_branch_04_push_yaml,
          "05-pull.yaml": ch03_branch_05_pull_yaml,
          "06-rebase.yaml": ch03_branch_06_rebase_yaml,
        },
      },
      "ch04-protocol": {
        chapter: ch04_protocol_chapter,
        lessons: {
          "01-local-clone.yaml": ch04_protocol_01_local_clone_yaml,
          "02-remote-branches.yaml": ch04_protocol_02_remote_branches_yaml,
        },
      },
      "ch05-distributed": {
        chapter: ch05_distributed_chapter,
        lessons: {
          "01-feature-branch.yaml": ch05_distributed_01_feature_branch_yaml,
          "02-integrate.yaml": ch05_distributed_02_integrate_yaml,
        },
      },
      "ch06-github": {
        chapter: ch06_github_chapter,
        lessons: {
          "01-fork-sync.yaml": ch06_github_01_fork_sync_yaml,
          "02-pr-merge.yaml": ch06_github_02_pr_merge_yaml,
        },
      },
      "ch07-tools": {
        chapter: ch07_tools_chapter,
        lessons: {
          "01-reflog.yaml": ch07_tools_01_reflog_yaml,
          "02-stash.yaml": ch07_tools_02_stash_yaml,
        },
      },
      "ch08-config": {
        chapter: ch08_config_chapter,
        lessons: {
          "01-alias.yaml": ch08_config_01_alias_yaml,
          "02-quotepath.yaml": ch08_config_02_quotepath_yaml,
        },
      },
      "ch09-migration": {
        chapter: ch09_migration_chapter,
        lessons: {
          "01-export-bundle.yaml": ch09_migration_01_export_bundle_yaml,
          "02-import-bundle.yaml": ch09_migration_02_import_bundle_yaml,
        },
      },
      "ch10-internals": {
        chapter: ch10_internals_chapter,
        lessons: {
          "01-blob-tree.yaml": ch10_internals_01_blob_tree_yaml,
          "02-commit-tag.yaml": ch10_internals_02_commit_tag_yaml,
        },
      },
    },
  },
};
