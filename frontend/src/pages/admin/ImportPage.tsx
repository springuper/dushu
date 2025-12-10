import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Text,
  Select,
  FileButton,
  Stack,
  Alert,
  Table,
  Badge,
  Code,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconUpload, IconAlertCircle, IconCheck } from '@tabler/icons-react'

// MVP 版本只支持事件和人物
const IMPORT_TYPES = [
  { value: 'event', label: '事件' },
  { value: 'person', label: '人物' },
]

function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [preview, setPreview] = useState<any>(null)

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post('/api/admin/import/batch', formData)
      return response.data
    },
    onSuccess: () => {
      setFile(null)
      setPreview(null)
    },
  })

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return

    setFile(selectedFile)

    // 预览文件内容
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string)
        setPreview({
          recordCount: Array.isArray(content) ? content.length : 1,
          sample: Array.isArray(content) ? content[0] : content,
        })
      } catch (error) {
        setPreview({ error: 'JSON 格式错误' })
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = () => {
    if (!file || !type) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    importMutation.mutate(formData)
  }

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">批量导入</Title>

      <Stack gap="lg">
        {/* 上传区域 */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Select
              label="导入类型"
              data={IMPORT_TYPES}
              value={type}
              onChange={setType}
              placeholder="选择导入类型"
              required
            />

            <div>
              <Text size="sm" fw={500} mb="xs">
                选择文件
              </Text>
              <Group>
                <FileButton
                  onChange={handleFileSelect}
                  accept="application/json"
                >
                  {(props) => (
                    <Button {...props} leftSection={<IconUpload size={16} />}>
                      选择 JSON 文件
                    </Button>
                  )}
                </FileButton>
                {file && (
                  <Text size="sm" c="dimmed">
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </Text>
                )}
              </Group>
            </div>

            {preview && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  文件预览
                </Text>
                {preview.error ? (
                  <Alert icon={<IconAlertCircle size={16} />} color="red">
                    {preview.error}
                  </Alert>
                ) : (
                  <Paper p="sm" withBorder>
                    <Text size="sm" mb="xs">
                      记录数：{preview.recordCount}
                    </Text>
                    <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(preview.sample, null, 2)}
                    </Code>
                  </Paper>
                )}
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!file || !type || !!preview?.error}
              loading={importMutation.isPending}
              leftSection={<IconUpload size={16} />}
            >
              开始导入
            </Button>
          </Stack>
        </Paper>

        {/* 导入结果 */}
        {importMutation.data && (
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group>
                <IconCheck size={20} color="green" />
                <Text fw={500}>导入完成</Text>
              </Group>

              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>总计</Table.Td>
                    <Table.Td>
                      <Badge>{importMutation.data.total}</Badge>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>成功</Table.Td>
                    <Table.Td>
                      <Badge color="green">{importMutation.data.successCount}</Badge>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>失败</Table.Td>
                    <Table.Td>
                      <Badge color="red">{importMutation.data.errorCount}</Badge>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>

              {importMutation.data.errors && importMutation.data.errors.length > 0 && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    错误详情（前 10 条）：
                  </Text>
                  {importMutation.data.errors.map((error: any, index: number) => (
                    <Alert key={index} color="red" mb="xs">
                      <Text size="xs">索引 {error.index}: {error.error}</Text>
                    </Alert>
                  ))}
                </div>
              )}

              {importMutation.data.reviewItems && importMutation.data.reviewItems.length > 0 && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    已创建 Review 项目：
                  </Text>
                  <Group gap="xs">
                    {importMutation.data.reviewItems.map((item: any) => (
                      <Badge key={item.id} variant="light">
                        {item.id.substring(0, 8)}...
                      </Badge>
                    ))}
                  </Group>
                </div>
              )}
            </Stack>
          </Paper>
        )}

        {importMutation.error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {importMutation.error?.response?.data?.error || importMutation.error.message}
          </Alert>
        )}
      </Stack>
    </Container>
  )
}

export default ImportPage

